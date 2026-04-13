import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { Brain, Loader2, History, RotateCcw, Briefcase } from 'lucide-react';

// 🔥 CONFIG DESDE VARIABLES DE ENTORNO (VERCEL)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = "cognitive-test-40";
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

const STAGES = {
  INTRO: 'intro',
  PRELOADING: 'preloading',
  QUIZ: 'quiz',
  RESULTS: 'results',
  HISTORY: 'history'
};

const QUESTIONS = [
  { id: 1, cat: 'Lógica', q: "Si todos los hombres son mortales y Sócrates es hombre, ¿Sócrates es mortal?", a: "Sí", opts: ["Sí", "No", "No se puede saber"] },
  { id: 2, cat: 'Lógica', q: "Si un tren eléctrico va al norte, ¿hacia dónde sale el humo?", a: "No sale humo", opts: ["Norte", "Sur", "No sale humo", "Este"] },
  { id: 3, cat: 'Lógica', q: "Busca la secuencia: 1, 2, 4, 7, 11, ...", a: "16", opts: ["14", "15", "16", "17"] },
  { id: 4, cat: 'Lenguaje', q: "¿Cuál es el antónimo de 'Efímero'?", a: "Duradero", opts: ["Breve", "Rápido", "Duradero", "Fugaz"] },
  { id: 5, cat: 'Numérica', q: "¿Cuánto es 15% de 200?", a: "30", opts: ["15", "20", "30", "40"] },
  { id: 6, cat: 'Visual', q: "¿Qué forma geométrica es?", prompt: "simple hexagon icon black on white", a: "Hexágono", opts: ["Círculo", "Hexágono", "Cuadrado"] }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [stage, setStage] = useState(STAGES.INTRO);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState([]);
  const [images, setImages] = useState({});
  const [progress, setProgress] = useState(0);
  const [alias, setAlias] = useState('');
  const [result, setResult] = useState(null);

  // 🔐 Auth
  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 📊 Historial
  useEffect(() => {
    if (!user) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'scores');
    return onSnapshot(ref, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // 🖼️ Precarga imágenes
  const preload = async () => {
    setStage(STAGES.PRELOADING);
    const visuals = QUESTIONS.filter(q => q.prompt);
    let loaded = 0;
    const temp = {};

    for (const q of visuals) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
          method: 'POST',
          body: JSON.stringify({
            instances: [{ prompt: q.prompt }],
            parameters: { sampleCount: 1 }
          })
        });
        const data = await res.json();
        if (data.predictions?.[0]?.bytesBase64Encoded) {
          temp[q.id] = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
        }
      } catch (e) {}

      loaded++;
      setProgress(Math.round((loaded / visuals.length) * 100));
    }

    setImages(temp);
    setStage(STAGES.QUIZ);
  };

  const answer = (opt) => {
    const correct = opt === QUESTIONS[idx].a;
    const newAns = [...answers, correct];
    setAnswers(newAns);

    if (idx < QUESTIONS.length - 1) {
      setIdx(idx + 1);
    } else {
      const score = Math.round((newAns.filter(x => x).length / QUESTIONS.length) * 1000);
      setResult(score);
      setStage(STAGES.RESULTS);
    }
  };

  const save = async () => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'scores'), {
      alias: alias || "Anon",
      score: result,
      timestamp: Date.now()
    });
    setStage(STAGES.HISTORY);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {stage === STAGES.INTRO && (
        <div className="text-center">
          <h1 className="text-3xl font-black">NEUROLAB</h1>
          <button onClick={preload} className="bg-indigo-600 text-white px-6 py-3 mt-6 rounded-xl">
            Iniciar
          </button>
        </div>
      )}

      {stage === STAGES.PRELOADING && (
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto" />
          <p>{progress}%</p>
        </div>
      )}

      {stage === STAGES.QUIZ && (
        <div>
          <h2>{QUESTIONS[idx].q}</h2>

          {QUESTIONS[idx].prompt && (
            <img src={images[QUESTIONS[idx].id]} className="my-4" />
          )}

          {QUESTIONS[idx].opts.map((o, i) => (
            <button key={i} onClick={() => answer(o)} className="block border p-3 my-2 w-full">
              {o}
            </button>
          ))}
        </div>
      )}

      {stage === STAGES.RESULTS && (
        <div className="text-center">
          <h2 className="text-4xl">{result}</h2>
          <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="Alias" />
          <button onClick={save} className="block bg-indigo-600 text-white p-3 mt-4 w-full">Guardar</button>
        </div>
      )}

      {stage === STAGES.HISTORY && (
        <div>
          <h2>Ranking</h2>
          {history.map(h => (
            <div key={h.id} className="border p-2 flex justify-between">
              <span>{h.alias}</span>
              <span>{h.score}</span>
            </div>
          ))}
          <button onClick={() => setStage(STAGES.INTRO)} className="mt-4">Reiniciar</button>
        </div>
      )}

    </div>
  );
                            }
