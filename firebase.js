// firebase.js
// Firebase configuration and initialization (moved from index.html)
// Load this AFTER the firebase-compat scripts included in index.html (firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js)
(function(){
  // Your web app's Firebase configuration (moved here)
  var firebaseConfig = {
    apiKey: "AIzaSyCk8F09Vofc3iIB1vZQZYcbNQ6nhwA9GxI",
    authDomain: "livro-caixa-65012.firebaseapp.com",
    projectId: "livro-caixa-65012",
    storageBucket: "livro-caixa-65012.appspot.com",
    messagingSenderId: "820871831234",
    appId: "1:820871831234:web:0408672ee1f7a4dcf2b930"
  };

  // Initialize Firebase if it hasn't been initialized yet
  try {
    if (!window.firebase) {
      console.warn('Firebase SDK not found. Make sure firebase-app-compat.js is loaded before firebase.js');
      return;
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn('Firebase initialization error (ignored):', e);
  }

  // Expose common references for other scripts (optional)
  try{
    window.firebaseAuth = firebase.auth ? firebase.auth() : null;
    window.db = firebase.firestore ? firebase.firestore() : null;
  }catch(e){
    // ignore
  }

  // mark
  window.__firebase_config_moved = true;
})();
