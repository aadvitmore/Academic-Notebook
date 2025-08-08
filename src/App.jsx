import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, serverTimestamp, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import ReactQuill from 'react-quill';
import katex from 'katex';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import 'react-quill/dist/quill.snow.css';
import 'katex/dist/katex.min.css';


window.katex = katex;

const firebaseConfig = {
  apiKey: "AIzaSyD8-UelP1buJONFD7YBbDYUhcAfu3rPYfI",
  authDomain: "academic-notebook.firebaseapp.com",
  projectId: "academic-notebook",
  storageBucket: "academic-notebook.firebasestorage.app",
  messagingSenderId: "503591508530",
  appId: "1:503591508530:web:04bd72aac49bb290ce3a2b",
  measurementId: "G-0FM5366KTZ"
};
const appId = firebaseConfig.projectId;


const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
);
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);
const SaveIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
);
const ExportIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
);

function App() {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [notes, setNotes] = useState([]);
    const [activeNote, setActiveNote] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const auth = getAuth(app);
            setDb(firestore);

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    const notesCollectionPath = `artifacts/${appId}/users/${user.uid}/notes`;
                    const q = query(collection(firestore, notesCollectionPath), orderBy('updatedAt', 'desc'));
                    
                    const unsubscribe = onSnapshot(q, (querySnapshot) => {
                        const notesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setNotes(notesData);

                        if (activeNote === null && notesData.length > 0) {
                            setActiveNote(notesData[0]);
                        } else if (activeNote === null) {
                            handleNewNote();
                        }
                        setIsLoading(false);
                    });
                    return () => unsubscribe();
                } else {
                    signInAnonymously(auth);
                }
            });
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
            setIsLoading(false);
        }
    }, [appId, activeNote]);

    const handleNewNote = () => {
        const newNote = { id: null, content: '<h1>Start Writing...</h1>', title: 'New Note', updatedAt: serverTimestamp() };
        setActiveNote(newNote);
    };

    const handleSaveNote = async () => {
        if (!db || !userId || !activeNote) return;
        setIsSaving(true);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = activeNote.content;
        const title = (tempDiv.textContent.trim().split('\n')[0] || 'Untitled Note').substring(0, 50);

        const noteData = {
            ...activeNote,
            title: title,
            updatedAt: serverTimestamp(),
        };

        const notesCollectionPath = `artifacts/${appId}/users/${userId}/notes`;
        try {
            if (activeNote.id) {
                const noteRef = doc(db, notesCollectionPath, activeNote.id);
                await setDoc(noteRef, noteData, { merge: true });
            } else {
                const docRef = await addDoc(collection(db, notesCollectionPath), noteData);
                setActiveNote({ ...noteData, id: docRef.id });
            }
        } catch (error) {
            console.error("Error saving note:", error);
        } finally {
            setTimeout(() => setIsSaving(false), 1000);
        }
    };

    const handleDeleteNote = async (noteId) => {
        if (!db || !userId) return;
        setNotes(notes.filter(n => n.id !== noteId));
        if (activeNote && activeNote.id === noteId) {
            setActiveNote(notes.length > 1 ? notes.find(n => n.id !== noteId) : null);
            if(notes.length <= 1) handleNewNote();
        }
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/notes`, noteId));
    };

    const handleExportPDF = () => {
        const editor = document.querySelector('.ql-editor');
        if (!editor) return;
        html2canvas(editor, { backgroundColor: '#ffffff' }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${activeNote.title.replace(/\s/g, '_') || 'document'}.pdf`);
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-400">
                <p>Loading Your Workspace...</p>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="flex h-screen bg-slate-900 text-slate-300 font-sans antialiased"
        >
            {/* Sidebar */}
            <aside className="w-80 flex-shrink-0 bg-slate-800/50 border-r border-slate-700/50 p-6 flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Academic Notepad</h1>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNewNote}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg mb-6 transition-colors duration-300"
                >
                    <PlusIcon />
                    New Note
                </motion.button>
                <div className="flex-grow overflow-y-auto -mr-3 pr-3">
                    <AnimatePresence>
                        {notes.map(note => (
                            <motion.div
                                key={note.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                onClick={() => setActiveNote(note)}
                                className={`p-4 rounded-lg cursor-pointer mb-3 transition-all duration-200 relative group ${activeNote?.id === note.id ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700/50'}`}
                            >
                                <h3 className="font-semibold text-white truncate pr-8">{note.title}</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {note.updatedAt?.toDate().toLocaleDateString()}
                                </p>
                                <motion.button
                                    whileHover={{ scale: 1.2 }}
                                    onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                                    className="absolute top-3 right-3 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <TrashIcon />
                                </motion.button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    {activeNote && (
                        <motion.div
                            key={activeNote.id || 'new-note'}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="flex-1 flex flex-col p-6"
                        >
                            <header className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white truncate">{activeNote.title}</h2>
                                <div className="flex items-center gap-3">
                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleSaveNote} className={`flex items-center gap-2 py-2 px-4 rounded-lg font-semibold transition-all duration-300 ${isSaving ? 'bg-green-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                                        <SaveIcon />
                                        {isSaving ? 'Saved!' : 'Save'}
                                    </motion.button>
                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleExportPDF} className="flex items-center gap-2 py-2 px-4 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors duration-300">
                                        <ExportIcon />
                                        Export PDF
                                    </motion.button>
                                </div>
                            </header>
                            <div className="flex-grow bg-white text-slate-900 rounded-xl shadow-2xl shadow-slate-900/50 overflow-hidden">
                                <ReactQuill
                                    theme="snow"
                                    value={activeNote.content}
                                    onChange={(content) => setActiveNote(prev => ({ ...prev, content }))}
                                    className="h-full custom-quill"
                                    modules={{
                                        toolbar: [
                                            [{ 'header': [1, 2, 3, false] }],
                                            ['bold', 'italic', 'underline', 'strike'],
                                            [{'list': 'ordered'}, {'list': 'bullet'}],
                                            ['link', 'image', 'video', 'formula'],
                                            ['clean']
                                        ]
                                    }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </motion.div>
    );
}

export default App;