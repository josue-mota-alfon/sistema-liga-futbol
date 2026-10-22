import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Cliente secundario para registros de usuarios por el Administrador
const supabaseSecondary = createClient(
  'https://cqwkybkmckumururqtd.supabase.co',
  'sb_publishable_E6Bxrw9YGQPGUNiQ1PLNgg_Cg1QwRGO',
  { auth: { persistSession: false } }
);

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Vistas principales: 'portal' | 'login' | 'dashboard'
  const [currentScreen, setCurrentScreen] = useState('portal');

  // Módulos del Dashboard: 'home' | 'usuarios' | 'clubs' | 'agenda' | 'resultados'
  const [activeModule, setActiveModule] = useState('home');

  // Subvistas
  const [userViewMode, setUserViewMode] = useState('list'); // 'list' | 'new'
  const [clubViewMode, setClubViewMode] = useState('list'); // 'list' | 'new'
  const [agendaViewMode, setAgendaViewMode] = useState('list'); // 'list' | 'new'

  // Estados de Formulario de Login + Captcha
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Captcha Dinámico
  const [captchaCode, setCaptchaCode] = useState('');
  const [inputCaptcha, setInputCaptcha] = useState('');

  // Menús desplegables Navbar
  const [openDropdown, setOpenDropdown] = useState(null);

  // Datos de la BD
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const [teamsList, setTeamsList] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [matchesList, setMatchesList] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Formulario Usuario Nuevo (Adaptado a Username)
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '', username: '', password: '',
    role: 'captain', assigned_team_id: '', is_active: true
  });

  // Formulario Club Nuevo
  const [creatingClub, setCreatingClub] = useState(false);
  const [newClub, setNewClub] = useState({
    name: '', primary_color: '#2563eb', stadium: 'Campo Municipal Altotonga 1', captain_id: ''
  });

  // Formulario Agenda Nuevo Partido
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [newMatch, setNewMatch] = useState({
    jornada: 'Jornada 1', fecha: '', hora: '10:00 AM', cancha: 'Campo Municipal Altotonga 1',
    local_team_id: '', visitante_team_id: ''
  });

  // Reloj
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
  );

  const generateCaptcha = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setInputCaptcha('');
  };

  useEffect(() => {
    generateCaptcha();
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }));
    }, 30000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        setCurrentScreen('dashboard');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        setCurrentScreen('dashboard');
      } else {
        setProfile(null);
        setCurrentScreen('portal');
        setLoading(false);
      }
    });

    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
    };
  }, []);

  // Cargar datos al iniciar sesión
  useEffect(() => {
    if (session) {
      fetchUsers();
      fetchTeams();
      fetchMatches();
    }
  }, [session]);

  // Subscripción en Tiempo Real (Supabase Realtime)
  useEffect(() => {
    if (!session) return;

    const profilesChannel = supabase
      .channel('realtime:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    const teamsChannel = supabase
      .channel('realtime:teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams();
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('realtime:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchMatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(matchesChannel);
    };
  }, [session]);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error perfil:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsersList(data || []);
    } catch (err) {
      console.error('Error al cargar usuarios:', err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*, profiles:captain_id (full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTeamsList(data || []);
    } catch (err) {
      console.error('Error al cargar equipos:', err.message);
    } finally {
      setTeamsLoading(false);
    }
  };

  const fetchMatches = async () => {
    setMatchesLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, local_team:local_team_id(name, primary_color), visitante_team:visitante_team_id(name, primary_color)')
        .order('fecha', { ascending: true });
      if (error) throw error;
      setMatchesList(data || []);
    } catch (err) {
      console.error('Error al cargar partidos:', err.message);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (inputCaptcha.trim().toLowerCase() !== captchaCode.toLowerCase()) {
      setLoginError('Código Captcha incorrecto.');
      generateCaptcha();
      return;
    }
    setAuthenticating(true);
    try {
      // Soporta tanto correo como nombre de usuario puro
      const cleanLogin = loginEmail.trim().toLowerCase();
      const authEmail = cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@altotonga.com`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: loginPassword,
      });
      if (error) throw error;
      if (data.user) {
        await fetchProfile(data.user.id);
        setCurrentScreen('dashboard');
      }
    } catch (err) {
      setLoginError('Credenciales inválidas.');
      generateCaptcha();
    } finally {
      setAuthenticating(false);
    }
  };

  // Guardado de Usuario procesando 'username' a formato compatible de correo
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.full_name) {
      return alert('Completa Nombre Completo, Usuario y Contraseña.');
    }
    setCreatingUser(true);
    try {
      const cleanUsername = newUser.username.trim().toLowerCase().replace(/\s+/g, '');
      const userEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@altotonga.com`;

      // 1. Crear cuenta de Autenticación
      const { data: authData, error: authError } = await supabaseSecondary.auth.signUp({
        email: userEmail,
        password: newUser.password,
        options: { data: { full_name: newUser.full_name, role: newUser.role, username: cleanUsername } }
      });

      if (authError) throw authError;

      // 2. Insertar o Actualizar el Perfil en la Base de Datos
      if (authData.user?.id) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          email: userEmail,
          username: cleanUsername,
          full_name: newUser.full_name,
          role: newUser.role,
          is_active: newUser.is_active,
          updated_at: new Date().toISOString()
        });

        if (profileError) throw profileError;

        if (newUser.role === 'captain' && newUser.assigned_team_id) {
          await supabase.from('teams').update({ captain_id: authData.user.id }).eq('id', newUser.assigned_team_id);
        }
      }

      alert(`Usuario "${cleanUsername}" registrado exitosamente.`);
      setUserViewMode('list');
      setNewUser({
        full_name: '', username: '', password: '',
        role: 'captain', assigned_team_id: '', is_active: true
      });
      fetchUsers();
    } catch (err) {
      alert('Error al registrar usuario: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!newClub.name) return alert('Ingresa el nombre del club.');
    setCreatingClub(true);
    try {
      const { error } = await supabase.from('teams').insert([{
        name: newClub.name,
        primary_color: newClub.primary_color,
        captain_id: newClub.captain_id || null
      }]);
      if (error) throw error;
      alert(`Club ${newClub.name} guardado correctamente.`);
      setClubViewMode('list');
      setNewClub({ name: '', primary_color: '#2563eb', stadium: 'Campo Municipal Altotonga 1', captain_id: '' });
      fetchTeams();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCreatingClub(false);
    }
  };

  const handleScheduleMatch = async (e) => {
    e.preventDefault();
    if (!newMatch.local_team_id || !newMatch.visitante_team_id || !newMatch.fecha) {
      return alert('Completa los datos del partido.');
    }
    setCreatingMatch(true);
    try {
      const { error } = await supabase.from('matches').insert([{
        jornada: newMatch.jornada,
        fecha: newMatch.fecha,
        hora: newMatch.hora,
        cancha: newMatch.cancha,
        local_team_id: newMatch.local_team_id,
        visitante_team_id: newMatch.visitante_team_id,
        goles_local: 0,
        goles_visitante: 0,
        estado: 'Programado'
      }]);
      if (error) throw error;
      alert('Partido agendado en el rol de juegos.');
      setAgendaViewMode('list');
      fetchMatches();
    } catch (err) {
      alert('Error al agendar partido: ' + err.message);
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleUpdateResult = async (matchId, gl, gv) => {
    try {
      const { error } = await supabase.from('matches').update({
        goles_local: parseInt(gl || 0),
        goles_visitante: parseInt(gv || 0),
        estado: 'Finalizado'
      }).eq('id', matchId);

      if (error) throw error;
      alert('Marcador y resultado actualizados.');
      fetchMatches();
    } catch (err) {
      alert('Error al actualizar resultado: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setCurrentScreen('portal');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 font-sans">
        <div className="text-center space-y-2">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
          <p className="text-xs font-bold text-slate-500 uppercase">Cargando Sistema Administrador...</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // PANTALLA 1: PORTAL DE BIENVENIDA
  // ==========================================================================
  if (currentScreen === 'portal') {
    return (
      <div className="relative min-h-screen w-full flex flex-col justify-between font-sans text-white select-none bg-slate-900">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2070&auto=format&fit=crop')` }}
        >
          <div className="absolute inset-0 bg-slate-950/70"></div>
        </div>

        <header className="relative z-10 px-8 py-5 flex justify-between items-center max-w-7xl mx-auto w-full border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl shadow">IG</div>
            <span className="font-bold text-sm tracking-widest uppercase">SISTEMA MUNICIPAL</span>
          </div>
          <nav className="flex items-center gap-8 text-xs font-bold tracking-widest text-slate-200">
            <button onClick={() => setCurrentScreen('login')} className="hover:text-blue-400 uppercase">SISTEMA</button>
            <button className="hover:text-blue-400 uppercase">MANUAL</button>
            <button className="hover:text-blue-400 uppercase">SOPORTE</button>
          </nav>
        </header>

        <main className="relative z-10 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col items-center text-center space-y-10">
          <div className="space-y-4 flex flex-col items-center">
            <div className="w-28 h-28 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex flex-col items-center justify-center p-4">
              <span className="text-3xl">🏛️</span>
              <span className="text-[10px] font-black tracking-widest mt-1 uppercase">ALTOTONGA</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase">BIENVENIDOS A LIGASYNC</h1>
            <p className="text-xs font-bold text-slate-300 tracking-widest uppercase bg-white/10 border border-white/15 px-5 py-1.5 rounded-full">
              H. AYUNTAMIENTO DE ALTOTONGA · 2026 / 2029
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <div onClick={() => setCurrentScreen('login')} className="cursor-pointer bg-slate-900/40 hover:bg-slate-900/70 border border-white/15 hover:border-blue-400 rounded-2xl p-8 backdrop-blur transition flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-2xl">🖥️</div>
              <h2 className="text-base font-black uppercase">SISTEMA</h2>
              <p className="text-xs text-slate-300">Acceso al portal de control administrativo de la Liga.</p>
            </div>
            <div className="bg-slate-900/40 border border-white/15 rounded-2xl p-8 backdrop-blur flex flex-col items-center text-center space-y-4 opacity-75">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-2xl">📖</div>
              <h2 className="text-base font-black uppercase">MANUAL</h2>
              <p className="text-xs text-slate-300">Reglamento oficial y procedimientos generales.</p>
            </div>
            <div className="bg-slate-900/40 border border-white/15 rounded-2xl p-8 backdrop-blur flex flex-col items-center text-center space-y-4 opacity-75">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-2xl">⚙️</div>
              <h2 className="text-base font-black uppercase">SOPORTE</h2>
              <p className="text-xs text-slate-300">Asistencia técnica e incidencias del portal.</p>
            </div>
          </div>
        </main>

        <footer className="relative z-10 py-5 text-center text-xs text-slate-400 border-t border-white/10">
          © 2026 Estratégica Global · Plataforma LigaSync
        </footer>
      </div>
    );
  }

  // ==========================================================================
  // PANTALLA 2: LOGIN INSTITUCIONAL
  // ==========================================================================
  if (currentScreen === 'login') {
    return (
      <div className="min-h-screen w-full bg-[#f4f6f8] font-sans flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col items-center text-center space-y-4">
            <span className="text-5xl">🏛️</span>
            <h1 className="text-2xl font-black">Plataforma de administración 7.0.0</h1>
            <p className="text-xs text-slate-500">Ingresa con tus credenciales registradas de administrador.</p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6">
            <div>
              <span className="text-[10px] font-black text-orange-600 tracking-widest uppercase">ACCESO</span>
              <h2 className="text-2xl font-black text-slate-800 mt-1">Ingresa con tu usuario y contraseña</h2>
            </div>

            {loginError && <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl">{loginError}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Usuario</label>
                <input type="text" required placeholder="Ingresa tu usuario" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full border border-blue-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Contraseña</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required placeholder="Contraseña" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-500 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{showPassword ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Captcha</label>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-slate-100 px-4 py-2 rounded-xl font-mono text-base font-black text-blue-700 line-through">{captchaCode}</div>
                  <button type="button" onClick={generateCaptcha} className="text-xs text-blue-600 font-bold hover:underline">🔄 Cambiar</button>
                </div>
                <input type="text" required placeholder="Capture el captcha" value={inputCaptcha} onChange={(e) => setInputCaptcha(e.target.value)} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-500" />
              </div>
              <button type="submit" disabled={authenticating} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2">🔒 {authenticating ? 'Autenticando...' : 'Ingresar'}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // PANTALLA 3: DASHBOARD ADMINISTRADOR
  // ==========================================================================
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-800 font-sans flex flex-col justify-between">
      <div>
        {/* NAVBAR SUPERIOR */}
        <header className="bg-[#1c242d] text-white px-6 h-12 flex items-center justify-between text-xs shadow z-30">
          <div className="flex items-center gap-6">
            <div className="h-7 w-7 bg-blue-600 rounded flex items-center justify-center font-black text-xs">IG</div>
            <nav className="flex items-center gap-1 font-semibold text-slate-300">
              <button onClick={() => { setActiveModule('home'); setOpenDropdown(null); }} className={`px-3 py-1.5 rounded hover:text-white hover:bg-slate-700 ${activeModule === 'home' ? 'text-white bg-slate-700' : ''}`}>
                🏠 Inicio (Tabla de Posiciones)
              </button>

              {/* MENÚ ADMINISTRACIÓN */}
              <div className="relative">
                <button onClick={() => setOpenDropdown(openDropdown === 'admin' ? null : 'admin')} className={`px-3 py-1.5 rounded hover:text-white hover:bg-slate-700 ${['usuarios', 'clubs'].includes(activeModule) ? 'text-white bg-slate-700' : ''}`}>
                  👥 Administración ▾
                </button>
                {openDropdown === 'admin' && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white text-slate-800 rounded-lg shadow-xl border py-1 z-40">
                    <button onClick={() => { setActiveModule('usuarios'); setUserViewMode('list'); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-medium">👥 Usuarios</button>
                    <button onClick={() => { setActiveModule('clubs'); setClubViewMode('list'); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-medium">🛡️ Clubs (Equipos)</button>
                  </div>
                )}
              </div>

              {/* MENÚ OPERACIÓN */}
              <div className="relative">
                <button onClick={() => setOpenDropdown(openDropdown === 'operacion' ? null : 'operacion')} className={`px-3 py-1.5 rounded hover:text-white hover:bg-slate-700 ${['agenda', 'resultados'].includes(activeModule) ? 'text-white bg-slate-700' : ''}`}>
                  🛡️ Operación ▾
                </button>
                {openDropdown === 'operacion' && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-white text-slate-800 rounded-lg shadow-xl border py-1 z-40">
                    <button onClick={() => { setActiveModule('agenda'); setAgendaViewMode('list'); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-medium">📅 Agenda / Rol de Juegos</button>
                    <button onClick={() => { setActiveModule('resultados'); setOpenDropdown(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-medium">⚽ Captura de Resultados</button>
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span>Admin: <strong className="text-white">{profile?.full_name || 'JOSUÉ'}</strong></span>
            <button onClick={handleLogout} className="bg-red-500/20 text-red-300 px-2.5 py-1 rounded text-[11px] font-bold border border-red-500/30">Cerrar Sesión</button>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="max-w-7xl w-full mx-auto p-6 space-y-6">

          {/* MÓDULO HOME: TABLA GENERAL DE POSICIONES */}
          {activeModule === 'home' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-100 via-blue-50 to-indigo-100 border border-blue-200 rounded-2xl p-6 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black text-blue-700 tracking-widest uppercase">LIGA MUNICIPAL DE ALTOTONGA</span>
                  <h1 className="text-2xl font-black text-slate-800 uppercase mt-0.5">TABLA GENERAL DE POSICIONES</h1>
                  <p className="text-xs text-slate-600">Estatus oficial del torneo y rendimiento de clubes en tiempo real.</p>
                </div>
                <div className="text-right text-xs font-mono text-slate-600">
                  <p>🕒 {currentTime}</p>
                  <p className="font-bold">Año Operativo: 2026</p>
                </div>
              </div>

              {/* TABLA DE POSICIONES */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#343a40] text-white font-bold">
                      <th className="py-3 px-4 text-center">POS</th>
                      <th className="py-3 px-4">EQUIPO / CLUB</th>
                      <th className="py-3 px-4 text-center">PJ</th>
                      <th className="py-3 px-4 text-center">PG</th>
                      <th className="py-3 px-4 text-center">PE</th>
                      <th className="py-3 px-4 text-center">PP</th>
                      <th className="py-3 px-4 text-center">GF</th>
                      <th className="py-3 px-4 text-center">GC</th>
                      <th className="py-3 px-4 text-center">DIF</th>
                      <th className="py-3 px-4 text-center font-black">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {teamsList.map((team, idx) => (
                      <tr key={team.id} className={idx === 0 ? "bg-emerald-50/60 font-medium" : "hover:bg-slate-50"}>
                        <td className="py-3 px-4 text-center font-bold">{idx === 0 ? `🥇 ${idx + 1}` : idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.primary_color || '#2563eb' }}></span>
                          {team.name}
                        </td>
                        <td className="py-3 px-4 text-center">0</td>
                        <td className="py-3 px-4 text-center text-emerald-600 font-bold">0</td>
                        <td className="py-3 px-4 text-center">0</td>
                        <td className="py-3 px-4 text-center text-red-500">0</td>
                        <td className="py-3 px-4 text-center">0</td>
                        <td className="py-3 px-4 text-center">0</td>
                        <td className="py-3 px-4 text-center font-bold">0</td>
                        <td className="py-3 px-4 text-center font-black text-blue-700 text-sm">0</td>
                      </tr>
                    ))}
                    {teamsList.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-6 text-slate-400">No hay clubes registrados para el torneo activo.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MÓDULO ADMINISTRACIÓN: USUARIOS */}
          {activeModule === 'usuarios' && (
            <div className="space-y-4">
              <div className="bg-[#e9ecef] text-[11px] font-medium px-4 py-2 rounded-lg text-slate-600 flex items-center gap-1.5">
                <button onClick={() => setActiveModule('home')} className="text-blue-600 hover:underline">Inicio</button>
                <span>/</span>
                <span className="text-slate-800 font-bold">Usuarios</span>
              </div>

              {userViewMode === 'list' ? (
                <>
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-normal text-slate-800">Usuarios</h1>
                    <button 
                      onClick={() => setUserViewMode('new')} 
                      className="bg-[#212529] hover:bg-[#121416] text-white text-xs font-medium px-5 py-2 rounded transition"
                    >
                      Nuevo
                    </button>
                  </div>

                  <div className="bg-[#343a40] p-3 rounded-lg">
                    <input
                      type="text"
                      placeholder="Search"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-64 bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#343a40] text-white font-bold">
                          <th className="py-3 px-4">Usuario</th>
                          <th className="py-3 px-4">Nombre</th>
                          <th className="py-3 px-4">Rol</th>
                          <th className="py-3 px-4">Estatus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {usersLoading ? (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-slate-400">Cargando usuarios...</td>
                          </tr>
                        ) : usersList.filter(u => 
                            (u.username || u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            (u.full_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            (u.role || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                          ).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-slate-400">No se encontraron usuarios registrados.</td>
                          </tr>
                        ) : (
                          usersList
                            .filter(u => 
                              (u.username || u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              (u.full_name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              (u.role || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                            )
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50 border-b border-slate-100">
                                <td className="py-3 px-4 font-mono font-bold text-slate-700">
                                  {u.username || u.email?.split('@')[0] || 'usuario'}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-800">{u.full_name || 'Sin Nombre'}</td>
                                <td className="py-3 px-4">
                                  <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                                    {u.role || 'Usuario'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    u.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {u.is_active !== false ? 'Activo' : 'Inactivo'}
                                  </span>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* FORMULARIO USUARIO NUEVO */
                <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-sm">
                  <div className="border-b pb-2">
                    <h2 className="text-2xl font-normal text-slate-800">Usuario nuevo</h2>
                  </div>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Completo</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Ej. Josué" 
                        value={newUser.full_name} 
                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Usuario</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Ej. josue" 
                        value={newUser.username} 
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="••••••••" 
                        value={newUser.password} 
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Rol en la Liga</label>
                      <select 
                        value={newUser.role} 
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                      >
                        <option value="admin">Administrador de Liga / Caja</option>
                        <option value="captain">Capitán de Club</option>
                        <option value="arbitro">Árbitro</option>
                      </select>
                    </div>

                    {newUser.role === 'captain' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Asignar Club</label>
                        <select 
                          value={newUser.assigned_team_id} 
                          onChange={(e) => setNewUser({ ...newUser, assigned_team_id: e.target.value })}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                        >
                          <option value="">Seleccionar Club</option>
                          {teamsList.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                      <button 
                        type="button" 
                        onClick={() => setUserViewMode('list')} 
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium px-4 py-2 rounded transition"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        disabled={creatingUser} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-5 py-2 rounded transition"
                      >
                        {creatingUser ? 'Guardando...' : 'Guardar Usuario'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MÓDULO ADMINISTRACIÓN: CLUBS */}
          {activeModule === 'clubs' && (
            <div className="space-y-4">
              <div className="bg-[#e9ecef] text-[11px] font-medium px-4 py-2 rounded-lg text-slate-600 flex items-center gap-1.5">
                <button onClick={() => setActiveModule('home')} className="text-blue-600 hover:underline">Inicio</button>
                <span>/</span><span>Administración</span><span>/</span>
                <span className="text-slate-800 font-bold">Clubs</span>
              </div>

              {clubViewMode === 'list' ? (
                <>
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-normal text-slate-800">Directorio de Clubs</h1>
                    <button onClick={() => setClubViewMode('new')} className="bg-[#212529] hover:bg-[#121416] text-white text-xs font-medium px-4 py-2 rounded transition">
                      + Registrar Club
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {teamsList.map((team) => (
                      <div key={team.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: team.primary_color || '#2563eb' }}>
                            {team.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Activo</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">{team.name}</h3>
                          <p className="text-xs text-slate-500">Capitán: {team.profiles?.full_name || 'Sin Asignar'}</p>
                          <p className="text-[11px] text-slate-400 mt-1">Sede: Campo Municipal Altotonga 1</p>
                        </div>
                      </div>
                    ))}
                    {teamsList.length === 0 && (
                      <div className="col-span-3 text-center py-8 text-slate-400 bg-white rounded-2xl border">No hay clubs registrados.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center border-b pb-3">
                    <h2 className="text-xl font-bold text-slate-800">Registrar Nuevo Club</h2>
                    <button onClick={() => setClubViewMode('list')} className="text-xs text-slate-500 hover:underline">Volver a lista</button>
                  </div>
                  <form onSubmit={handleCreateClub} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Club / Equipo</label>
                      <input type="text" required placeholder="Ej. Real Madrid CF" value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Color Distintivo</label>
                      <input type="color" value={newClub.primary_color} onChange={(e) => setNewClub({ ...newClub, primary_color: e.target.value })} className="h-10 w-20 rounded cursor-pointer border p-1" />
                    </div>
                    <button type="submit" disabled={creatingClub} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition">
                      {creatingClub ? 'Guardando...' : 'Guardar Club'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MÓDULO OPERACIÓN: AGENDA / ROL DE JUEGOS */}
          {activeModule === 'agenda' && (
            <div className="space-y-4">
              <div className="bg-[#e9ecef] text-[11px] font-medium px-4 py-2 rounded-lg text-slate-600 flex items-center gap-1.5">
                <button onClick={() => setActiveModule('home')} className="text-blue-600 hover:underline">Inicio</button>
                <span>/</span><span>Operación</span><span>/</span>
                <span className="text-slate-800 font-bold">Agenda</span>
              </div>

              {agendaViewMode === 'list' ? (
                <>
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-normal text-slate-800">Rol de Juegos</h1>
                    <button onClick={() => setAgendaViewMode('new')} className="bg-[#212529] hover:bg-[#121416] text-white text-xs font-medium px-4 py-2 rounded transition">
                      + Agendar Partido
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchesList.map((m) => (
                      <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                        <div className="flex justify-between text-xs font-bold text-slate-500 border-b pb-2">
                          <span>{m.jornada}</span>
                          <span>{m.fecha} · {m.hora}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-bold text-slate-800 py-2">
                          <span style={{ color: m.local_team?.primary_color }}>{m.local_team?.name || 'Local'}</span>
                          <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-mono">{m.goles_local} - {m.goles_visitante}</span>
                          <span style={{ color: m.visitante_team?.primary_color }}>{m.visitante_team?.name || 'Visitante'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 text-center">📍 {m.cancha}</div>
                      </div>
                    ))}
                    {matchesList.length === 0 && (
                      <div className="col-span-2 text-center py-8 text-slate-400 bg-white rounded-2xl border">No hay partidos agendados.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center border-b pb-3">
                    <h2 className="text-xl font-bold text-slate-800">Programar Partido</h2>
                    <button onClick={() => setAgendaViewMode('list')} className="text-xs text-slate-500 hover:underline">Volver</button>
                  </div>
                  <form onSubmit={handleScheduleMatch} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Jornada</label>
                      <input type="text" required value={newMatch.jornada} onChange={(e) => setNewMatch({ ...newMatch, jornada: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Equipo Local</label>
                        <select required value={newMatch.local_team_id} onChange={(e) => setNewMatch({ ...newMatch, local_team_id: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs outline-none">
                          <option value="">Selecciona equipo</option>
                          {teamsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Equipo Visitante</label>
                        <select required value={newMatch.visitante_team_id} onChange={(e) => setNewMatch({ ...newMatch, visitante_team_id: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs outline-none">
                          <option value="">Selecciona equipo</option>
                          {teamsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Fecha</label>
                        <input type="date" required value={newMatch.fecha} onChange={(e) => setNewMatch({ ...newMatch, fecha: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Hora</label>
                        <input type="text" required value={newMatch.hora} onChange={(e) => setNewMatch({ ...newMatch, hora: e.target.value })} className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs outline-none" />
                      </div>
                    </div>
                    <button type="submit" disabled={creatingMatch} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition">
                      {creatingMatch ? 'Agendando...' : 'Guardar Partido'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MÓDULO OPERACIÓN: CAPTURA DE RESULTADOS */}
          {activeModule === 'resultados' && (
            <div className="space-y-4">
              <h1 className="text-3xl font-normal text-slate-800">Captura de Resultados</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchesList.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex justify-between text-xs text-slate-500 font-bold border-b pb-2">
                      <span>{m.jornada}</span>
                      <span>{m.fecha}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 flex-1">{m.local_team?.name || 'Local'}</span>
                      <input type="number" defaultValue={m.goles_local} id={`gl-${m.id}`} className="w-12 text-center border rounded-lg py-1 font-mono text-xs font-bold" />
                      <span className="text-xs font-bold">-</span>
                      <input type="number" defaultValue={m.goles_visitante} id={`gv-${m.id}`} className="w-12 text-center border rounded-lg py-1 font-mono text-xs font-bold" />
                      <span className="text-xs font-bold text-slate-800 flex-1 text-right">{m.visitante_team?.name || 'Visitante'}</span>
                    </div>
                    <button onClick={() => {
                      const gl = document.getElementById(`gl-${m.id}`)?.value;
                      const gv = document.getElementById(`gv-${m.id}`)?.value;
                      handleUpdateResult(m.id, gl, gv);
                    }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl transition">
                      💾 Guardar Resultado
                    </button>
                  </div>
                ))}
                {matchesList.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-slate-400 bg-white rounded-2xl border">No hay partidos pendientes para capturar resultado.</div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      <footer className="py-4 text-center text-xs text-slate-400 border-t bg-white">
        © 2026 LigaSync · Liga Municipal de Fútbol Altotonga
      </footer>
    </div>
  );
}