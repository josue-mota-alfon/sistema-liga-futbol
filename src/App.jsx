import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  // --- ESTADOS PRINCIPALES ---
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  // --- ESTADOS DE AUTENTICACIÓN Y LOGIN ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [inputCaptcha, setInputCaptcha] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // --- ESTADOS DE DATOS ---
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE FORMULARIOS ---
  const [userViewMode, setUserViewMode] = useState('list');
  const [newUser, setNewUser] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'captain',
    assigned_team_id: '',
    is_active: true
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const [teamViewMode, setTeamViewMode] = useState('list');
  const [newTeam, setNewTeam] = useState({
    name: '',
    primary_color: '#0055ff',
    secondary_color: '#ffffff'
  });
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [matchViewMode, setMatchViewMode] = useState('list');
  const [newMatch, setNewMatch] = useState({
    home_team_id: '',
    away_team_id: '',
    match_date: '',
    field: 'Campo Principal'
  });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [editingScoreMatch, setEditingScoreMatch] = useState(null);
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);

  const generateCaptcha = () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setCaptchaCode(code);
  };

  useEffect(() => {
    generateCaptcha();
    fetchUsers();
    fetchTeams();
    fetchMatches();
  }, []);

  // --- CONSULTAS DE DATOS ---
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setUsers(data);
    } catch (e) {
      console.error('Error cargando usuarios:', e);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*, profiles:captain_id(full_name)')
        .order('created_at', { ascending: false });
      if (!error && data) setTeams(data);
    } catch (e) {
      console.error('Error cargando equipos:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, home_team:home_team_id(name), away_team:away_team_id(name)')
        .order('match_date', { ascending: true });
      if (!error && data) setMatches(data);
    } catch (e) {
      console.error('Error cargando partidos:', e);
    }
  };

  // --- LOGIN ---
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
      const cleanLogin = loginEmail.trim().toLowerCase();
      const authEmail = cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@altotonga.com`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: loginPassword,
      });

      if (!error && data.user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        setProfile(prof || { full_name: cleanLogin, role: 'admin' });
        setSession(data.session);
        setCurrentScreen('dashboard');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.eq.${cleanLogin},email.eq.${authEmail}`)
        .maybeSingle();

      if (profileData && profileData.is_active !== false) {
        setProfile(profileData);
        setSession({ user: { id: profileData.id, email: profileData.email } });
        setCurrentScreen('dashboard');
      } else {
        throw new Error('Credenciales inválidas.');
      }
    } catch (err) {
      setLoginError('Credenciales inválidas o usuario inactivo.');
      generateCaptcha();
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setCurrentScreen('dashboard');
  };

  // --- USUARIOS ---
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.full_name) {
      return alert('Completa Nombre Completo, Usuario y Contraseña.');
    }
    setCreatingUser(true);
    try {
      const cleanUsername = newUser.username.trim().toLowerCase().replace(/\s+/g, '');
      const userEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@altotonga.com`;
      const newUserId = crypto.randomUUID();

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: newUserId,
        email: userEmail,
        username: cleanUsername,
        full_name: newUser.full_name,
        role: newUser.role,
        is_active: true,
        updated_at: new Date().toISOString()
      }]);

      if (profileError) throw profileError;

      if (newUser.role === 'captain' && newUser.assigned_team_id) {
        await supabase.from('teams').update({ captain_id: newUserId }).eq('id', newUser.assigned_team_id);
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

  const handleToggleUserStatus = async (user) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      if (!error) fetchUsers();
    } catch (e) {
      alert('Error al cambiar estado.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) fetchUsers();
    } catch (e) {
      alert('Error al eliminar usuario.');
    }
  };

  // --- CLUBES ---
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name) return alert('El nombre del club es obligatorio.');
    setCreatingTeam(true);
    try {
      const { error } = await supabase.from('teams').insert([{
        name: newTeam.name,
        primary_color: newTeam.primary_color,
        secondary_color: newTeam.secondary_color
      }]);
      if (error) throw error;
      alert(`Club "${newTeam.name}" registrado correctamente.`);
      setTeamViewMode('list');
      setNewTeam({ name: '', primary_color: '#0055ff', secondary_color: '#ffffff' });
      fetchTeams();
    } catch (err) {
      alert('Error al crear equipo: ' + err.message);
    } finally {
      setCreatingTeam(false);
    }
  };

  // --- PARTIDOS ---
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (!newMatch.home_team_id || !newMatch.away_team_id || !newMatch.match_date) {
      return alert('Completa los campos obligatorios del partido.');
    }
    if (newMatch.home_team_id === newMatch.away_team_id) {
      return alert('El equipo local y visitante no pueden ser el mismo.');
    }
    setCreatingMatch(true);
    try {
      const { error } = await supabase.from('matches').insert([{
        home_team_id: newMatch.home_team_id,
        away_team_id: newMatch.away_team_id,
        match_date: newMatch.match_date,
        field: newMatch.field,
        status: 'scheduled'
      }]);
      if (error) throw error;
      alert('Partido agendado con éxito.');
      setMatchViewMode('list');
      setNewMatch({ home_team_id: '', away_team_id: '', match_date: '', field: 'Campo Principal' });
      fetchMatches();
    } catch (err) {
      alert('Error al agendar partido: ' + err.message);
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleUpdateMatchScore = async (e) => {
    e.preventDefault();
    if (!editingScoreMatch) return;
    try {
      const { error } = await supabase.from('matches').update({
        home_score: parseInt(scoreHome),
        away_score: parseInt(scoreAway),
        status: 'completed'
      }).eq('id', editingScoreMatch.id);

      if (error) throw error;
      alert('Resultado guardado correctamente.');
      setEditingScoreMatch(null);
      fetchMatches();
    } catch (err) {
      alert('Error al guardar resultado: ' + err.message);
    }
  };

  // --- TABLA GENERAL DE POSICIONES ---
  const calculateStandings = () => {
    const table = {};
    teams.forEach(t => {
      table[t.id] = {
        id: t.id,
        name: t.name,
        pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dif: 0, pts: 0
      };
    });

    matches.filter(m => m.status === 'completed').forEach(m => {
      const home = table[m.home_team_id];
      const away = table[m.away_team_id];
      if (home && away) {
        const hs = m.home_score || 0;
        const as = m.away_score || 0;

        home.pj += 1;
        away.pj += 1;
        home.gf += hs;
        home.gc += as;
        away.gf += as;
        away.gc += hs;

        if (hs > as) {
          home.pg += 1;
          home.pts += 3;
          away.pp += 1;
        } else if (as > hs) {
          away.pg += 1;
          away.pts += 3;
          home.pp += 1;
        } else {
          home.pe += 1;
          home.pts += 1;
          away.pe += 1;
          away.pts += 1;
        }

        home.dif = home.gf - home.gc;
        away.dif = away.gf - away.gc;
      }
    });

    return Object.values(table).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dif !== a.dif) return b.dif - a.dif;
      return b.gf - a.gf;
    });
  };

  const standings = calculateStandings();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentScreen('dashboard')}>
          <div className="bg-blue-600 text-white font-black text-xl px-3 py-1 rounded-lg">LigaSync</div>
          <span className="font-semibold text-lg hidden sm:inline">Liga Municipal de Altotonga</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentScreen === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            Inicio (Tabla)
          </button>

          {session && (
            <>
              <button
                onClick={() => setCurrentScreen('users')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentScreen === 'users' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                Usuarios
              </button>
              <button
                onClick={() => setCurrentScreen('teams')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentScreen === 'teams' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                Clubes
              </button>
              <button
                onClick={() => setCurrentScreen('matches')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentScreen === 'matches' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                Agenda / Resultados
              </button>
            </>
          )}

          {session ? (
            <div className="flex items-center gap-3 ml-2 border-l border-slate-800 pl-4">
              <span className="text-xs text-slate-400">
                {profile?.full_name || 'Admin'}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentScreen('login')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {currentScreen === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-800/50 p-6 rounded-2xl flex flex-wrap justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white uppercase">Tabla General de Posiciones</h1>
                <p className="text-slate-400 text-sm mt-1">Estatus oficial del torneo y rendimiento de clubes en tiempo real.</p>
              </div>
              <div className="bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300">
                Año Operativo: 2026
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300 text-xs uppercase tracking-wider">
                      <th className="p-4 text-center w-16">Pos</th>
                      <th className="p-4">Equipo / Club</th>
                      <th className="p-4 text-center">PJ</th>
                      <th className="p-4 text-center">PG</th>
                      <th className="p-4 text-center">PE</th>
                      <th className="p-4 text-center">PP</th>
                      <th className="p-4 text-center">GF</th>
                      <th className="p-4 text-center">GC</th>
                      <th className="p-4 text-center">DIF</th>
                      <th className="p-4 text-center font-bold text-blue-400">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {standings.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-8 text-center text-slate-500">
                          No hay clubes registrados para el torneo activo.
                        </td>
                      </tr>
                    ) : (
                      standings.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition">
                          <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-4 font-semibold text-white flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                            {item.name}
                          </td>
                          <td className="p-4 text-center">{item.pj}</td>
                          <td className="p-4 text-center text-emerald-400">{item.pg}</td>
                          <td className="p-4 text-center text-amber-400">{item.pe}</td>
                          <td className="p-4 text-center text-red-400">{item.pp}</td>
                          <td className="p-4 text-center">{item.gf}</td>
                          <td className="p-4 text-center">{item.gc}</td>
                          <td className="p-4 text-center">{item.dif > 0 ? `+${item.dif}` : item.dif}</td>
                          <td className="p-4 text-center font-black text-blue-400 text-base">{item.pts}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentScreen === 'login' && (
          <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Acceso al Sistema</h2>
            <p className="text-slate-400 text-xs text-center mb-6">Ingresa tus credenciales autorizadas</p>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-xl mb-4 text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Usuario o Correo</label>
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="ejemplo: josue"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Código de Seguridad (Captcha)</label>
                <div className="flex gap-3 items-center">
                  <div className="bg-slate-800 border border-slate-700 font-mono text-lg font-bold tracking-widest text-blue-400 px-4 py-2.5 rounded-xl select-none">
                    {captchaCode}
                  </div>
                  <input
                    type="text"
                    required
                    value={inputCaptcha}
                    onChange={(e) => setInputCaptcha(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 uppercase"
                    placeholder="Código"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authenticating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition mt-4"
              >
                {authenticating ? 'Verificando...' : 'Entrar'}
              </button>
            </form>
          </div>
        )}

        {currentScreen === 'users' && session && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
              <button
                onClick={() => setUserViewMode(userViewMode === 'list' ? 'create' : 'list')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition"
              >
                {userViewMode === 'list' ? '+ Nuevo Usuario' : 'Volver a la Lista'}
              </button>
            </div>

            {userViewMode === 'create' ? (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg mx-auto">
                <h3 className="text-lg font-bold text-white mb-4">Registrar Nuevo Usuario</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Nombre de Usuario</label>
                    <input
                      type="text"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Rol en la Liga</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="captain">Capitán de Club</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  {newUser.role === 'captain' && (
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Asignar Club</label>
                      <select
                        value={newUser.assigned_team_id}
                        onChange={(e) => setNewUser({ ...newUser, assigned_team_id: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Seleccionar Club --</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
                  >
                    {creatingUser ? 'Guardando...' : 'Guardar Usuario'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/80 text-slate-300 text-xs uppercase">
                    <tr>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Usuario</th>
                      <th className="p-4">Rol</th>
                      <th className="p-4 text-center">Estatus</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/40">
                        <td className="p-4 font-semibold text-white">{u.full_name}</td>
                        <td className="p-4 text-slate-400">{u.username || u.email}</td>
                        <td className="p-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                            {u.role === 'admin' ? 'Administrador' : 'Capitán'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full ${u.is_active !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {u.is_active !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-4 text-center space-x-2">
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg text-slate-300"
                          >
                            {u.is_active !== false ? 'Inactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/30"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentScreen === 'teams' && session && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Gestión de Clubes</h2>
              <button
                onClick={() => setTeamViewMode(teamViewMode === 'list' ? 'create' : 'list')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition"
              >
                {teamViewMode === 'list' ? '+ Nuevo Club' : 'Volver a la Lista'}
              </button>
            </div>

            {teamViewMode === 'create' ? (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg mx-auto">
                <h3 className="text-lg font-bold text-white mb-4">Registrar Nuevo Club</h3>
                <form onSubmit={handleCreateTeam} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Nombre del Club / Equipo</label>
                    <input
                      type="text"
                      required
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Color Principal</label>
                      <input
                        type="color"
                        value={newTeam.primary_color}
                        onChange={(e) => setNewTeam({ ...newTeam, primary_color: e.target.value })}
                        className="w-full h-10 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Color Secundario</label>
                      <input
                        type="color"
                        value={newTeam.secondary_color}
                        onChange={(e) => setNewTeam({ ...newTeam, secondary_color: e.target.value })}
                        className="w-full h-10 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingTeam}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
                  >
                    {creatingTeam ? 'Guardando...' : 'Guardar Club'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(t => (
                  <div key={t.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-white">{t.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Capitán: {t.profiles?.full_name || 'Sin asignar'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full border border-slate-700" style={{ backgroundColor: t.primary_color }}></span>
                      <span className="w-5 h-5 rounded-full border border-slate-700" style={{ backgroundColor: t.secondary_color }}></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentScreen === 'matches' && session && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Rol de Juegos y Resultados</h2>
              <button
                onClick={() => setMatchViewMode(matchViewMode === 'list' ? 'create' : 'list')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition"
              >
                {matchViewMode === 'list' ? '+ Agendar Partido' : 'Volver a la Lista'}
              </button>
            </div>

            {matchViewMode === 'create' ? (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg mx-auto">
                <h3 className="text-lg font-bold text-white mb-4">Agendar Partido</h3>
                <form onSubmit={handleCreateMatch} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Equipo Local</label>
                    <select
                      required
                      value={newMatch.home_team_id}
                      onChange={(e) => setNewMatch({ ...newMatch, home_team_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Seleccionar Local --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Equipo Visitante</label>
                    <select
                      required
                      value={newMatch.away_team_id}
                      onChange={(e) => setNewMatch({ ...newMatch, away_team_id: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Seleccionar Visitante --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Fecha y Hora</label>
                    <input
                      type="datetime-local"
                      required
                      value={newMatch.match_date}
                      onChange={(e) => setNewMatch({ ...newMatch, match_date: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingMatch}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
                  >
                    {creatingMatch ? 'Agendando...' : 'Agendar Partido'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map(m => (
                  <div key={m.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6 text-base font-bold">
                      <span className="text-white w-32 text-right">{m.home_team?.name || 'Local'}</span>
                      <span className="bg-slate-800 px-4 py-2 rounded-xl text-blue-400 font-mono text-lg border border-slate-700">
                        {m.status === 'completed' ? `${m.home_score} - ${m.away_score}` : 'VS'}
                      </span>
                      <span className="text-white w-32">{m.away_team?.name || 'Visitante'}</span>
                    </div>

                    <div className="text-xs text-slate-400">
                      {new Date(m.match_date).toLocaleString('es-MX')}
                    </div>

                    <div>
                      {m.status === 'completed' ? (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                          Finalizado
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingScoreMatch(m);
                            setScoreHome(0);
                            setScoreAway(0);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-xl transition"
                        >
                          Capturar Resultado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editingScoreMatch && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md">
                  <h3 className="text-lg font-bold text-white mb-4 text-center">Capturar Marcador Final</h3>
                  <form onSubmit={handleUpdateMatchScore} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">{editingScoreMatch.home_team?.name}</label>
                        <input
                          type="number"
                          min="0"
                          value={scoreHome}
                          onChange={(e) => setScoreHome(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-center text-xl text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">{editingScoreMatch.away_team?.name}</label>
                        <input
                          type="number"
                          min="0"
                          value={scoreAway}
                          onChange={(e) => setScoreAway(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-center text-xl text-white font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setEditingScoreMatch(null)}
                        className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm"
                      >
                        Guardar Marcador
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}