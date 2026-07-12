import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Image,
  Pressable,
  Alert,
  Modal,
  Platform,
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { isValidEmail, formatPhoneBR, toTitleCase, isUuid, sanitizeNameInput, dataOrRead } from './utils';
import {
  listChecklists,
  getChecklist,
  saveChecklist,
  updateChecklist,
  deleteChecklist,
  getCurrentUser,
  signIn,
  signOut,
  getProfile,
  isSupabaseReady,
} from './db';
import styles from './styles';

const makeInitialForm = () => ({
  nome: '',
  endereco: '',
  locCtoLink: '',
  fotoCto: null,
  fotoCtoDataUri: null,
  corFibra: '',
  possuiSplitter: null,
  portaCliente: '',
  locCasaLink: '',
  fotoFrenteCasa: null,
  fotoFrenteCasaDataUri: null,
  fotoInstalacao: null,
  fotoInstalacaoDataUri: null,
  fotoMacEquip: null,
  fotoMacEquipDataUri: null,
  nomeWifi: '',
  senhaWifi: '',
  testeNavegacaoOk: null,
  clienteSatisfeito: null,
});

const Section = ({ title, children, expanded, onToggle, style }) => (
  <View style={[styles.section, style]}>
    <Pressable onPress={onToggle} style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionToggle}>{expanded ? '▲' : '▼'}</Text>
    </Pressable>
    {expanded && <View style={styles.sectionBody}>{children}</View>}
  </View>
);

export default function App() {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
  const envReady = !!(envUrl && envKey);
  if (!envReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.envContainer}>
          <Text style={styles.envTitle}>Configuração do Supabase ausente</Text>
          <Text style={styles.envText}>EXPO_PUBLIC_SUPABASE_URL: {envUrl || 'vazio'}</Text>
          <Text style={styles.envText}>EXPO_PUBLIC_SUPABASE_KEY: {envKey ? 'presente' : 'vazia'}</Text>
          <Text style={styles.envWarn}>Atualize variáveis no EAS e gere novo build</Text>
          </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  
  const initialUserIdWeb = Platform.OS === 'web' && typeof window !== 'undefined' ? (() => {
    try {
      const id = window.localStorage.getItem('sessionUserId');
      const started = Number(window.localStorage.getItem('sessionStartedAt') || '0');
      const now = Date.now();
      const eightHours = 8 * 60 * 60 * 1000;
      if (id && started && now - started <= eightHours) return id;
    } catch {}
    return null;
  })() : null;
  const initialModeWeb = Platform.OS === 'web'
    ? ((initialUserIdWeb && typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname !== '/login') ? 'editor' : 'auth')
    : 'auth';
  const [expanded, setExpanded] = useState({
    cliente: true,
    cto: false,
    casa: false,
    interna: false,
    finalizacao: false,
  });

  const [form, setForm] = useState(makeInitialForm());
  const [originalForm, setOriginalForm] = useState(makeInitialForm());
  const [mode, setMode] = useState(initialModeWeb);
  const [authEmail, setAuthEmail] = useState('demo@demo.com');
  const [authPassword, setAuthPassword] = useState('demo1234');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [userId, setUserIdState] = useState(initialUserIdWeb);
  const [userName, setUserName] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [route, setRoute] = useState(
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname || '/home' : '/login'
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveModalMessage, setSaveModalMessage] = useState('');
  const [bannerType, setBannerType] = useState('success');
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const senhaWifiRef = useRef(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerOpacityStyle = useMemo(() => ({ opacity: bannerOpacity }), [bannerOpacity]);
  const bannerTimerRef = useRef(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingKey, setLocatingKey] = useState(null);
  const [isNavigatingList, setIsNavigatingList] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const locCtoRef = useRef(null);
  const locCasaRef = useRef(null);
  

  const onLogout = async () => {
    try {
      await signOut();
    } catch {}
    setUserIdState(null);
    setUserName(null);
    setList([]);
    resetUIForNew();
    setAuthEmail('demo@demo.com');
    setAuthPassword('demo1234');
    setMode('auth');
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try { window.localStorage.removeItem('sessionStartedAt'); } catch {}
        try { window.localStorage.removeItem('sessionUserId'); } catch {}
      }
    } catch {}
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.pushState({}, '', '/login');
      setRoute('/login');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          const ready = typeof isSupabaseReady === 'function' ? isSupabaseReady() : true;
          const u = await getCurrentUser();
          if (u && u.id) {
            let sessionOk = true;
            try {
              const startedRaw = typeof window !== 'undefined' ? window.localStorage.getItem('sessionStartedAt') : null;
              const started = Number(startedRaw || '0');
              const now = Date.now();
              const eightHours = 8 * 60 * 60 * 1000;
              if (!started || now - started > eightHours) {
                sessionOk = false;
                try { await signOut(); } catch {}
              }
            } catch {}
            if (sessionOk) {
              setUserIdState(u.id);
              try {
                const p = await getProfile(u.id);
                const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
                setUserName(nm || p?.first_name || null);
              } catch {}
              await refreshList();
            } else {
              try { window.localStorage.removeItem('sessionStartedAt'); } catch {}
              window.history.replaceState({}, '', '/login');
              setRoute('/login');
              setMode('auth');
            }
          } else {
            let lsUserId = null;
            let lsStarted = 0;
            try {
              lsUserId = window.localStorage.getItem('sessionUserId');
              lsStarted = Number(window.localStorage.getItem('sessionStartedAt') || '0');
            } catch {}
            const now2 = Date.now();
            const eightHours2 = 8 * 60 * 60 * 1000;
            if (lsUserId && lsStarted && now2 - lsStarted <= eightHours2) {
              setUserIdState(lsUserId);
              if (ready) {
                try {
                  const p = await getProfile(lsUserId);
                  const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
                  setUserName(nm || p?.first_name || null);
                } catch {}
              }
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/home');
                setRoute('/home');
              }
              setMode('editor');
              await refreshList();
            } else {
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, '', '/login');
                setRoute('/login');
              }
              setMode('auth');
            }
          }
        } else {
          const u = await getCurrentUser();
          if (u && u.id) {
            setUserIdState(u.id);
            try {
              const p = await getProfile(u.id);
              const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
              setUserName(nm || p?.first_name || null);
            } catch {}
            await refreshList();
          } else {
            setMode('auth');
          }
        }
      } catch (e) {
        console.error(e);
        setErrorMessage('Falha ao inicializar. Verifique configuração do Supabase (URL/KEY).');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (errorMessage) {
      setBannerType('error');
      setSaveModalMessage(errorMessage);
      setSaveModalVisible(true);
    }
    return () => {};
  }, [errorMessage]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sync = () => {
        let p = window.location.pathname || '/home';
        if (p === '/') {
          window.history.replaceState({}, '', '/home');
          p = '/home';
        }
        setRoute(p);
        if (p === '/login') {
            setMode('auth');
        } else if (p === '/checklists') {
          setMode('list');
        } else {
          setMode('editor');
        }
      };
      window.addEventListener('popstate', sync);
      return () => { window.removeEventListener('popstate', sync); };
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (saveModalVisible) {
      Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start();
      if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
      bannerTimerRef.current = setTimeout(() => {
        Animated.timing(bannerOpacity, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' }).start(() => {
          setSaveModalVisible(false);
        });
      }, 3500);
      return () => {
        if (bannerTimerRef.current) { clearTimeout(bannerTimerRef.current); bannerTimerRef.current = null; }
      };
    }
    return () => {};
  }, [saveModalVisible]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (!loading && !userId && (route === '/home' || route === '/checklists')) {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/login');
          setRoute('/login');
        }
        setMode('auth');
      }
    }
  }, [userId, route, loading]);

  const refreshList = async () => {
    const rows = await listChecklists(userId);
    setList(rows);
  };


  const compressDataUri = async (dataUri, maxW = 1024, maxH = 1024, quality = 0.45) => {
    try {
      if (!dataUri) return null;
      if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
        return dataUri;
      }
      const img = new Image();
      const loaded = await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = (e) => reject(e);
        img.src = dataUri;
      });
      if (!loaded) return dataUri;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return dataUri;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      const tw = Math.round(w * ratio);
      const th = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, tw, th);
      const out = canvas.toDataURL('image/jpeg', quality);
      return out || dataUri;
    } catch {
      return dataUri;
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const askCameraAndPick = async (fieldKey) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && libPerm.status !== 'granted') {
      Alert.alert('Permissão', 'Permissão de câmera/galeria necessária.');
      return;
    }
    let result;
    try {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
    } catch (e) {
      result = null;
    }
    if (!result || result.canceled) {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
    }
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const lower = (uri || '').toLowerCase();
      const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const b64 = asset.base64;
      const dataUriKeyMap = {
        fotoCto: 'fotoCtoDataUri',
        fotoFrenteCasa: 'fotoFrenteCasaDataUri',
        fotoInstalacao: 'fotoInstalacaoDataUri',
        fotoMacEquip: 'fotoMacEquipDataUri',
      };
      const dataKey = dataUriKeyMap[fieldKey];
      let dataUri = b64 ? `data:${mime};base64,${b64}` : null;
      if (dataKey && dataUri) {
        dataUri = await compressDataUri(dataUri, 1280, 1280, 0.5);
      }
      setForm((prev) => ({
        ...prev,
        [fieldKey]: uri,
        ...(dataKey && dataUri ? { [dataKey]: dataUri } : {}),
      }));
    }
  };

  const getCurrentCoords = async (precisa = false) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      let best = null;
      let finalPos = null;
      try {
        finalPos = await new Promise((resolve) => {
          const wid = navigator.geolocation.watchPosition(
            (p) => {
              const acc = typeof p?.coords?.accuracy === 'number' ? p.coords.accuracy : null;
              if (!best || (acc != null && acc < (best?.coords?.accuracy ?? Infinity))) best = p;
              if (acc != null && acc <= (precisa ? 15 : 30)) {
                try { navigator.geolocation.clearWatch(wid); } catch {}
                resolve(p);
              }
            },
            () => {
              try { navigator.geolocation.clearWatch(wid); } catch {}
              resolve(null);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
          );
          setTimeout(() => {
            try { navigator.geolocation.clearWatch(wid); } catch {}
            resolve(best);
          }, precisa ? 15000 : 8000);
        });
      } catch {}
      if (finalPos?.coords?.latitude && finalPos?.coords?.longitude) {
        return { lat: finalPos.coords.latitude, lng: finalPos.coords.longitude };
      }
      if (precisa) return null;
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 3000);
        const resp = await fetch('https://ipinfo.io/json', { signal: ctrl.signal });
        clearTimeout(to);
        if (resp && resp.ok) {
          const j = await resp.json();
          const parts = typeof j?.loc === 'string' ? j.loc.split(',') : [];
          if (parts.length === 2) return { lat: Number(parts[0]), lng: Number(parts[1]) };
        }
      } catch {}
      return null;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Ative a permissão de localização nas configurações do sistema para continuar.');
      return null;
    }
    try {
      const provider = await Location.getProviderStatusAsync();
      if (!provider?.locationServicesEnabled) {
        Alert.alert('Serviços de localização desligados', 'Ative GPS/Serviços de localização no aparelho para obter sua posição.');
      }
    } catch {}
    let best = null;
    let resolveFn;
    const done = new Promise((resolve) => { resolveFn = resolve; });
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (p) => {
        const acc = typeof p?.coords?.accuracy === 'number' ? p.coords.accuracy : null;
        if (!best || (acc != null && acc < (best?.coords?.accuracy ?? Infinity))) best = p;
        if (acc != null && acc <= (precisa ? 15 : 50)) resolveFn(p);
      }
    );
    setTimeout(() => resolveFn(best), precisa ? 15000 : 12000);
    const finalPos = await done;
    try { sub?.remove(); } catch {}
    if (!(finalPos?.coords?.latitude && finalPos?.coords?.longitude)) {
      try {
        const single = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest, maximumAge: 10000 });
        if (!best || (typeof single?.coords?.accuracy === 'number' && single.coords.accuracy < (best?.coords?.accuracy ?? Infinity))) {
          best = single;
        }
      } catch {}
    }
    if (!(best?.coords?.latitude && best?.coords?.longitude)) {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords?.latitude && last?.coords?.longitude) { best = last; }
      } catch {}
    }
    if (best?.coords?.latitude && best?.coords?.longitude) {
      return { lat: best.coords.latitude, lng: best.coords.longitude };
    }
    Alert.alert('Erro', 'Não foi possível obter sua localização no aparelho.');
    return null;
  };

  const useCurrentLocation = async (fieldKey) => {
    setIsLocating(true);
    setLocatingKey(fieldKey);
    try {
      const pos = await getCurrentCoords();
      if (pos) {
        setField(fieldKey, `https://www.google.com/maps?q=${Number(pos.lat).toFixed(6)},${Number(pos.lng).toFixed(6)}`);
      }
    } catch {}
    finally {
      setIsLocating(false);
      setLocatingKey(null);
    }
  };

  const preencherEndereco = async () => {
    setIsLocating(true);
    setLocatingKey('endereco');
    try {
      const pos = await getCurrentCoords(true);
      if (!pos) {
        setBannerType('warn');
        setSaveModalMessage('Sinal de GPS fraco. Tente perto de uma janela ou preencha manualmente.');
        setSaveModalVisible(true);
        return;
      }
      let rua = '', numero = '', bairro = '', cidade = '';
      if (Platform.OS === 'web') {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}&zoom=18&addressdetails=1&accept-language=pt-BR`
        );
        const j = resp.ok ? await resp.json() : null;
        const a = j?.address || {};
        rua = a.road || a.pedestrian || '';
        numero = a.house_number || '';
        bairro = a.suburb || a.neighbourhood || a.quarter || '';
        cidade = a.city || a.town || a.village || a.municipality || '';
      } else {
        const results = await Location.reverseGeocodeAsync({ latitude: pos.lat, longitude: pos.lng });
        const r = results?.[0];
        if (r) {
          rua = r.street || '';
          numero = r.streetNumber || '';
          bairro = r.district || '';
          cidade = r.city || r.subregion || '';
        }
      }
      if (rua || bairro || cidade) {
        const partes = [[rua, numero].filter(Boolean).join(', '), bairro, cidade].filter(Boolean);
        setField('endereco', partes.join(' - '));
      } else {
        setBannerType('warn');
        setSaveModalMessage('Não foi possível identificar o endereço. Preencha manualmente.');
        setSaveModalVisible(true);
      }
    } catch {}
    finally {
      setIsLocating(false);
      setLocatingKey(null);
    }
  };


  

  

  const ToggleYesNo = ({ value, onChange }) => (
    <View style={styles.toggleRow}>
      <Pressable
        onPress={() => onChange(true)}
        style={[styles.toggleBtn, value === true && styles.toggleActive]}
      >
        <Text style={[styles.toggleText, value === true && styles.toggleTextActive]}>✅ Sim</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(false)}
        style={[styles.toggleBtn, value === false && styles.toggleActive]}
      >
        <Text style={[styles.toggleText, value === false && styles.toggleTextActive]}>❌ Não</Text>
      </Pressable>
    </View>
  );

  const resetForm = () => {
    const init = makeInitialForm();
    setForm(init);
    setOriginalForm(init);
    setCurrentId(null);
  };

  const resetUIForNew = () => {
    resetForm();
    setExpanded({ cliente: true, cto: false, casa: false, interna: false, finalizacao: false });
  };

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(originalForm),
    [form, originalForm]
  );

  const onSave = async () => {
    try {
      setIsSaving(true);
      if (Platform.OS === 'web') {
        const ready = typeof isSupabaseReady === 'function' ? isSupabaseReady() : true;
        if (!ready) {
          setBannerType('error');
          setSaveModalMessage('Supabase não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_KEY.');
          setSaveModalVisible(true);
          return;
        }
      }
      senhaWifiRef.current?.blur();
      await new Promise((r) => setTimeout(r, 50));
      const useUserId = isUuid(userId) ? userId : null;
      if (!currentId) {
        const id = await saveChecklist(form, useUserId);
        if (!id) {
          setBannerType('error');
          setSaveModalMessage('Falha ao criar checklist.');
          setSaveModalVisible(true);
          return;
        }
        setCurrentId(id);
        setOriginalForm(form);
        setBannerType('success');
        setSaveModalMessage('Checklist criado com sucesso.');
        setSaveModalVisible(true);
        resetUIForNew();
      } else {
        await updateChecklist(currentId, form, userId);
        setOriginalForm(form);
        setBannerType('success');
        setSaveModalMessage('Checklist atualizado com sucesso.');
        setSaveModalVisible(true);
      }
      await refreshList();
    } catch (e) {
      console.error(e);
      setBannerType('error');
      const msg = (e && (e.message || e.error_description || e.hint)) ? (e.message || e.error_description || e.hint) : 'Não foi possível salvar. Verifique conexão e configuração do Supabase.';
      setSaveModalMessage(msg);
      setSaveModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  const createReady = useMemo(() => {
    const s = (v) => (v || '').trim();
    return (
      s(form.nome) &&
      s(form.endereco) &&
      s(form.locCtoLink) &&
      s(form.locCasaLink) &&
      s(form.corFibra) &&
      form.possuiSplitter !== null &&
      s(form.portaCliente) &&
      s(form.nomeWifi) &&
      s(form.senhaWifi) &&
      form.testeNavegacaoOk !== null &&
      form.clienteSatisfeito !== null &&
      (form.fotoCtoDataUri || form.fotoCto) &&
      (form.fotoFrenteCasaDataUri || form.fotoFrenteCasa) &&
      (form.fotoInstalacaoDataUri || form.fotoInstalacao) &&
      (form.fotoMacEquipDataUri || form.fotoMacEquip)
    );
  }, [form]);

  const onExportPdf = async () => {
    try {
      const imgCto = await dataOrRead(form.fotoCtoDataUri, form.fotoCto);
      const imgCasa = await dataOrRead(form.fotoFrenteCasaDataUri, form.fotoFrenteCasa);
      const imgInst = await dataOrRead(form.fotoInstalacaoDataUri, form.fotoInstalacao);
      const imgMac = await dataOrRead(form.fotoMacEquipDataUri, form.fotoMacEquip);

      const yesNo = (v) => (v === true ? 'Sim' : v === false ? 'Não' : '—');

      let displayUser = (userName || '').trim();
      let displayEmail = '';
      let displayPhone = '';
      try {
        const u0 = await getCurrentUser();
        displayEmail = u0?.email || '';
        const uid0 = u0?.id || userId;
        if (uid0) {
          const p0 = await getProfile(uid0);
          const nm0 = [p0?.first_name, p0?.last_name].filter(Boolean).join(' ').trim();
          displayUser = displayUser || nm0;
          displayPhone = p0?.phone ? formatPhoneBR(p0.phone) : '';
        }
      } catch {}
      const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: -apple-system, Roboto, Arial; background:#f6f7fb; padding: 10px; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
            .title { font-size:20px; font-weight:700; color:#222; }
            .meta { font-size:12px; color:#666; }
            .card { background:#fff; border-radius:8px; padding:10px; box-shadow:0 2px 6px rgba(0,0,0,0.06); margin:12px 0; page-break-inside: avoid; break-inside: avoid; }
            .cardHeader { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .badge { display:inline-block; background:#e1e8ff; color:#2f6fed; font-weight:700; font-size:12px; border-radius:6px; padding:4px 8px; margin-right:8px; }
            .cardTitle { font-size:16px; font-weight:600; color:#333; }
            .row { margin:4px 0; font-size:13px; color:#444; line-height:1.35; break-inside: avoid; page-break-inside: avoid; }
            .label { font-weight:600; }
            .figure { display:flex; flex-direction:column; align-items:flex-start; margin:6px 0; break-inside: avoid; page-break-inside: avoid; }
            .img { width:260px; height:160px; object-fit:cover; border-radius:8px; }
            a { color:#2f6fed; text-decoration:none; }
            .link { word-break: break-all; }
            .card4 { padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Checklist</div>
            <div class="meta">${new Date().toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Usuário:</span> ${displayUser || ''}</div>
            <div class="row"><span class="label">E‑mail:</span> ${displayEmail || ''}</div>
            <div class="row"><span class="label">Telefone:</span> ${displayPhone || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div></div>
            ${form.nome ? `<div class="row"><span class="label">Nome completo:</span> ${toTitleCase(form.nome)}</div>` : ''}
            ${form.endereco ? `<div class="row"><span class="label">Endereço:</span> ${form.endereco}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div></div>
            ${form.locCtoLink ? `<div class="row"><span class="label">Localização da CTO (link do Maps):</span> <span class="link"><a href="${form.locCtoLink}">${form.locCtoLink}</a></span></div>` : ''}
            ${imgCto ? `<div class="row"><span class="label">Foto da CTO</span></div><div class="figure"><img class="img" src="${imgCto}" alt="Foto da CTO" /></div>` : ''}
            ${form.corFibra ? `<div class="row"><span class="label">Cor da fibra:</span> ${form.corFibra}</div>` : ''}
            ${form.possuiSplitter !== null ? `<div class="row"><span class="label">Possui splitter?</span> ${yesNo(form.possuiSplitter)}</div>` : ''}
            ${form.portaCliente ? `<div class="row"><span class="label">Número da porta utilizada pelo cliente:</span> ${form.portaCliente}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div></div>
            ${form.locCasaLink ? `<div class="row"><span class="label">Localização da casa (link do Maps):</span> <span class="link"><a href="${form.locCasaLink}">${form.locCasaLink}</a></span></div>` : ''}
            ${imgCasa ? `<div class="row"><span class="label">Foto da frente da casa</span></div><div class="figure"><img class="img" src="${imgCasa}" alt="Foto da frente da casa" /></div>` : ''}
          </div>

          <div class="card card4">
            <div class="cardHeader"><div><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div></div>
            ${imgInst ? `<div class="row"><span class="label">Foto da instalação do equipamento (ONT/Router)</span></div><div class="figure"><img class="img" src="${imgInst}" alt="Foto da instalação do equipamento (ONT/Router)" /></div>` : ''}
            ${imgMac ? `<div class="row"><span class="label">Foto do MAC do equipamento</span></div><div class="figure"><img class="img" src="${imgMac}" alt="Foto do MAC do equipamento" /></div>` : ''}
            ${form.nomeWifi ? `<div class="row"><span class="label">Nome do Wi‑Fi:</span> ${form.nomeWifi}</div>` : ''}
            ${form.senhaWifi ? `<div class="row"><span class="label">Senha do Wi‑Fi:</span> ${form.senhaWifi}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">5</span><span class="cardTitle">Finalização</span></div></div>
            ${form.testeNavegacaoOk !== null ? `<div class="row"><span class="label">Teste de navegação realizado com sucesso?</span> ${yesNo(form.testeNavegacaoOk)}</div>` : ''}
            ${form.clienteSatisfeito !== null ? `<div class="row"><span class="label">Cliente ciente e satisfeito com o serviço?</span> ${yesNo(form.clienteSatisfeito)}</div>` : ''}
          </div>
        </body>
      </html>`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const w = window.open('', '_blank');
          if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { try { w.print(); } catch {} }, 300);
          }
        } catch {}
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao gerar/compartilhar PDF.');
    }
  };

  const onExportPdfItem = async (id) => {
    try {
      setIsExporting(true);
      setExportingId(id);
      const row = await getChecklist(id, userId);
      if (!row) return;

      

      let displayUser = (userName || '').trim();
      let displayEmail = '';
      let displayPhone = '';
      try {
        const u0 = await getCurrentUser();
        displayEmail = u0?.email || '';
        const uid0 = u0?.id || userId;
        if (uid0) {
          const p0 = await getProfile(uid0);
          const nm0 = [p0?.first_name, p0?.last_name].filter(Boolean).join(' ').trim();
          displayUser = displayUser || nm0;
          displayPhone = p0?.phone ? formatPhoneBR(p0.phone) : '';
        }
      } catch {}
      const f = {
        nome: row.nome || '',
        endereco: row.ruaNumero || row.ruanumero || '',
        locCtoLink: row.locCtoLink || row.locctolink || '',
        fotoCto: row.fotoCto || row.fotocto || null,
        fotoCtoDataUri: row.fotoCtoDataUri || row.fotoctodatauri || null,
        corFibra: row.corFibra || row.corfibra || '',
        possuiSplitter:
          row.possuiSplitter === 1 || row.possuisplitter === 1
            ? true
            : row.possuiSplitter === 0 || row.possuisplitter === 0
            ? false
            : null,
        portaCliente: row.portaCliente || row.portacliente || '',
        locCasaLink: row.locCasaLink || row.loccasalink || '',
        fotoFrenteCasa: row.fotoFrenteCasa || row.fotofrentecasa || null,
        fotoFrenteCasaDataUri: row.fotoFrenteCasaDataUri || row.fotofrentecasadatauri || null,
        fotoInstalacao: row.fotoInstalacao || row.fotoinstalacao || null,
        fotoInstalacaoDataUri: row.fotoInstalacaoDataUri || row.fotoinstalacaodatauri || null,
        fotoMacEquip: row.fotoMacEquip || row.fotomacequip || null,
        fotoMacEquipDataUri: row.fotoMacEquipDataUri || row.fotomacequipdatauri || null,
        nomeWifi: row.nomeWifi || row.nomewifi || '',
        senhaWifi: row.senhaWifi || row.senhawifi || '',
        testeNavegacaoOk:
          row.testeNavegacaoOk === 1 || row.testenavegacaook === 1
            ? true
            : row.testeNavegacaoOk === 0 || row.testenavegacaook === 0
            ? false
            : null,
        clienteSatisfeito:
          row.clienteSatisfeito === 1 || row.clientesatisfeito === 1
            ? true
            : row.clienteSatisfeito === 0 || row.clientesatisfeito === 0
            ? false
            : null,
      };
      const imgCto = await dataOrRead(f.fotoCtoDataUri, f.fotoCto);
      const imgCasa = await dataOrRead(f.fotoFrenteCasaDataUri, f.fotoFrenteCasa);
      const imgInst = await dataOrRead(f.fotoInstalacaoDataUri, f.fotoInstalacao);
      const imgMac = await dataOrRead(f.fotoMacEquipDataUri, f.fotoMacEquip);

      const yesNo = (v) => (v === 1 || v === true ? 'Sim' : v === 0 || v === false ? 'Não' : '—');

      const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px; background:#f6f7fb; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
            .title { font-size:20px; font-weight:700; color:#222; }
            .meta { font-size:12px; color:#666; }
            .card { background:#fff; border-radius:8px; padding:10px; box-shadow:0 2px 6px rgba(0,0,0,0.06); margin:12px 0; page-break-inside: avoid; break-inside: avoid; }
            .cardHeader { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .badge { display:inline-block; background:#e1e8ff; color:#2f6fed; font-weight:700; font-size:12px; border-radius:6px; padding:4px 8px; margin-right:8px; }
            .cardTitle { font-size:16px; font-weight:600; color:#333; }
            .row { margin:4px 0; font-size:13px; color:#444; line-height:1.35; break-inside: avoid; page-break-inside: avoid; }
            .label { font-weight:600; }
            .figure { display:flex; flex-direction:column; align-items:flex-start; margin:6px 0; break-inside: avoid; page-break-inside: avoid; }
            .img { width:260px; height:160px; object-fit:cover; border-radius:8px; }
            a { color:#2f6fed; text-decoration:none; }
            .link { word-break: break-all; }
            .card4 { padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Checklist</div>
            <div class="meta">${new Date().toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Usuário:</span> ${displayUser || ''}</div>
            <div class="row"><span class="label">E‑mail:</span> ${displayEmail || ''}</div>
            <div class="row"><span class="label">Telefone:</span> ${displayPhone || ''}</div>
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div></div>
            ${f.nome ? `<div class="row"><span class="label">Nome completo:</span> ${toTitleCase(f.nome)}</div>` : ''}
            ${f.endereco ? `<div class="row"><span class="label">Endereço:</span> ${f.endereco}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div></div>
            ${f.locCtoLink ? `<div class="row"><span class="label">Localização da CTO (link do Maps):</span> <span class="link"><a href="${f.locCtoLink}">${f.locCtoLink}</a></span></div>` : ''}
            ${imgCto ? `<div class="row"><span class="label">Foto da CTO</span></div><div class="figure"><img class="img" src="${imgCto}" alt="Foto da CTO" /></div>` : ''}
            ${f.corFibra ? `<div class="row"><span class="label">Cor da fibra:</span> ${f.corFibra}</div>` : ''}
            ${f.possuiSplitter !== null ? `<div class="row"><span class="label">Possui splitter?</span> ${yesNo(f.possuiSplitter)}</div>` : ''}
            ${f.portaCliente ? `<div class="row"><span class="label">Número da porta utilizada pelo cliente:</span> ${f.portaCliente}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div></div>
            ${f.locCasaLink ? `<div class="row"><span class="label">Localização da casa (link do Maps):</span> <span class="link"><a href="${f.locCasaLink}">${f.locCasaLink}</a></span></div>` : ''}
            ${imgCasa ? `<div class="row"><span class="label">Foto da frente da casa</span></div><div class="figure"><img class="img" src="${imgCasa}" alt="Foto da frente da casa" /></div>` : ''}
          </div>

          <div class="card card4">
            <div class="cardHeader"><div><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div></div>
            ${imgInst ? `<div class="row"><span class="label">Foto da instalação do equipamento (ONT/Router)</span></div><div class="figure"><img class="img" src="${imgInst}" alt="Foto da instalação do equipamento (ONT/Router)" /></div>` : ''}
            ${imgMac ? `<div class="row"><span class="label">Foto do MAC do equipamento</span></div><div class="figure"><img class="img" src="${imgMac}" alt="Foto do MAC do equipamento" /></div>` : ''}
            ${f.nomeWifi ? `<div class="row"><span class="label">Nome do Wi‑Fi:</span> ${f.nomeWifi}</div>` : ''}
            ${f.senhaWifi ? `<div class="row"><span class="label">Senha do Wi‑Fi:</span> ${f.senhaWifi}</div>` : ''}
          </div>

          <div class="card">
            <div class="cardHeader"><div><span class="badge">5</span><span class="cardTitle">Finalização</span></div></div>
            ${f.testeNavegacaoOk !== null ? `<div class="row"><span class="label">Teste de navegação realizado com sucesso?</span> ${yesNo(f.testeNavegacaoOk)}</div>` : ''}
            ${f.clienteSatisfeito !== null ? `<div class="row"><span class="label">Cliente ciente e satisfeito com o serviço?</span> ${yesNo(f.clienteSatisfeito)}</div>` : ''}
          </div>
        </body>
      </html>`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const w = window.open('', '_blank');
          if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { try { w.print(); } catch {} }, 300);
          }
        } catch {}
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao gerar/compartilhar PDF do item.');
    } finally {
      setIsExporting(false);
      setExportingId(null);
    }
  };

  const loadChecklist = async (id) => {
    try {
      const row = await getChecklist(id, userId);
      if (!row) return;
      const loaded = {
        nome: row.nome || '',
        endereco: row.ruaNumero || row.ruanumero || '',
        locCtoLink: row.locCtoLink || row.locctolink || '',
        fotoCto: row.fotoCto || row.fotocto || null,
        fotoCtoDataUri: row.fotoCtoDataUri || row.fotoctodatauri || null,
        corFibra: row.corFibra || row.corfibra || '',
        possuiSplitter:
          row.possuiSplitter === 1 || row.possuisplitter === 1
            ? true
            : row.possuiSplitter === 0 || row.possuisplitter === 0
            ? false
            : null,
        portaCliente: row.portaCliente || row.portacliente || '',
        locCasaLink: row.locCasaLink || row.loccasalink || '',
        fotoFrenteCasa: row.fotoFrenteCasa || row.fotofrentecasa || null,
        fotoFrenteCasaDataUri: row.fotoFrenteCasaDataUri || row.fotofrentecasadatauri || null,
        fotoInstalacao: row.fotoInstalacao || row.fotoinstalacao || null,
        fotoInstalacaoDataUri: row.fotoInstalacaoDataUri || row.fotoinstalacaodatauri || null,
        fotoMacEquip: row.fotoMacEquip || row.fotomacequip || null,
        fotoMacEquipDataUri: row.fotoMacEquipDataUri || row.fotomacequipdatauri || null,
        nomeWifi: row.nomeWifi || row.nomewifi || '',
        senhaWifi: row.senhaWifi || row.senhawifi || '',
        testeNavegacaoOk:
          row.testeNavegacaoOk === 1 || row.testenavegacaook === 1
            ? true
            : row.testeNavegacaoOk === 0 || row.testenavegacaook === 0
            ? false
            : null,
        clienteSatisfeito:
          row.clienteSatisfeito === 1 || row.clientesatisfeito === 1
            ? true
            : row.clienteSatisfeito === 0 || row.clientesatisfeito === 0
            ? false
            : null,
      };
      setForm(loaded);
      setOriginalForm(loaded);
      setCurrentId(row.id);
      setMode('editor');
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar checklist.');
    }
  };

  const onDeleteRequest = (id) => {
    setConfirmDeleteId(id);
    setDeleteModalVisible(true);
  };

  const onConfirmDelete = async () => {
    try {
      if (confirmDeleteId != null) {
        await deleteChecklist(confirmDeleteId, userId);
        await refreshList();
      if (confirmDeleteId === currentId) {
        resetForm();
      }
      setBannerType('error');
      setSaveModalMessage('Checklist deletado com sucesso.');
      setSaveModalVisible(true);
    }
    } finally {
      setDeleteModalVisible(false);
      setConfirmDeleteId(null);
    }
  };

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const groupedMonths = useMemo(() => {
    const groups = {};
    for (const item of list) {
      const d = new Date(item.created_at);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = { label: `${monthNames[m]} ${y}`, items: [] };
      groups[key].items.push(item);
    }
    const sorted = Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    );
    return sorted;
  }, [list]);

  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    const keys = Object.keys(groupedMonths);
    if (keys.length === 0) return;
    setExpandedMonths((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of keys) { if (next[k] === undefined) { next[k] = true; changed = true; } }
      return changed ? next : prev;
    });
  }, [groupedMonths]);

  const actionLabel = currentId ? 'Salvar Alterações' : 'Criar Checklist';
  const wantsAuthRoute = Platform.OS === 'web' && (route === '/login' || route === '/cadastrar' || route === '/reset');
  const effectiveMode = Platform.OS === 'web' && (!userId || wantsAuthRoute) ? 'auth' : mode;
  const canSubmit = currentId ? true : createReady;

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <Pressable
          style={[styles.headerIconBtn, styles.pointerCursor]}
          onPress={async () => {
            if (mode === 'auth') return;
            try {
              let firstN = '', lastN = '', phoneN = '', emailN = '', cpfN = '';
              const u = await getCurrentUser();
              const uid = u?.id || userId;
              emailN = u?.email || '';
              if (uid) {
                const p = await getProfile(uid);
                firstN = p?.first_name || '';
                lastN = p?.last_name || '';
                phoneN = p?.phone || '';
                cpfN = p?.cpf || '';
              }
              setEditFirstName(firstN);
              setEditLastName(lastN);
              setEditPhone(phoneN ? formatPhoneBR(phoneN) : '');
              setEditEmail(emailN || '');
              setShowEditPassword(false);
            } catch {}
            setEditUserModalVisible(true);
          }}
        >
          <MaterialCommunityIcons name="account-edit" size={40} color="#6b7280" />
        </Pressable>
        <View style={[styles.row, styles.ml8]}>
          {effectiveMode !== 'auth' ? (
            <>
              {effectiveMode === 'editor' ? (
                <Pressable style={styles.headerBtn} onPress={async () => { try { setIsNavigatingList(true); if (Platform.OS === 'web') { window.history.pushState({}, '', '/checklists'); setRoute('/checklists'); setMode('list'); } else { setMode('list'); } await refreshList(); } finally { setIsNavigatingList(false); } }}>
                  {isNavigatingList ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.headerBtnText}>Checklists</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable style={styles.headerBtn} onPress={() => { resetUIForNew(); if (Platform.OS === 'web') { window.history.pushState({}, '', '/home'); setRoute('/home'); setMode('editor'); } else { setMode('editor'); } }}>
                  <Text style={styles.headerBtnText}>Voltar</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.headerBtn, styles.headerBtnLogout]}
                onPress={onLogout}
              >
                <Text style={styles.headerBtnText}>Sair</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}> 
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      {effectiveMode === 'auth' ? (
        <LinearGradient
          colors={["#eef2ff", "#f8f9fc", "#eaf0ff"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bgGradient}
        />
      ) : null}
      {effectiveMode !== 'auth' ? <Header /> : null}

      <Modal
        transparent
        visible={deleteModalVisible}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirmar exclusão</Text>
            <Text style={styles.modalText}>Deseja deletar este checklist?</Text>
            <View style={[styles.row, styles.mt12]}>
              <Pressable style={[styles.btnSecondary, styles.flex1]} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.btnDanger, styles.flex1]} onPress={onConfirmDelete}>
                <Text style={styles.btnText}>Deletar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={editUserModalVisible}
        animationType="fade"
        onRequestClose={() => setEditUserModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <>
              <Text style={styles.modalTitle}>Perfil</Text>
              <TextInput
                style={[styles.input, { opacity: 0.7 }]}
                placeholder="Nome"
                placeholderTextColor="#9aa0b5"
                value={editFirstName}
                editable={false}
              />
              <TextInput
                style={[styles.input, { opacity: 0.7 }]}
                placeholder="Sobrenome"
                placeholderTextColor="#9aa0b5"
                value={editLastName}
                editable={false}
              />
              <TextInput
                style={[styles.input, { opacity: 0.7 }]}
                placeholder="Telefone"
                placeholderTextColor="#9aa0b5"
                value={editPhone}
                editable={false}
              />
              <TextInput
                style={[styles.input, { opacity: 0.7 }]}
                placeholder="E-mail"
                placeholderTextColor="#9aa0b5"
                value={editEmail}
                editable={false}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon, { opacity: 0.7 }]}
                  placeholder="Senha"
                  placeholderTextColor="#9aa0b5"
                  value="demo1234"
                  editable={false}
                  secureTextEntry={!showEditPassword}
                  autoComplete="off"
                  textContentType="none"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showEditPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  style={styles.inputIconBtn}
                  onPress={() => setShowEditPassword((v) => !v)}
                >
                  <Feather name={showEditPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
                </Pressable>
              </View>
            </>
          <View style={styles.row}>
              <Pressable
                style={[styles.btn, styles.flex1]}
                onPress={() => setEditUserModalVisible(false)}
              >
                <Text style={styles.btnText}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {saveModalVisible ? (
        <View style={styles.bannerWrap}>
          <Animated.View style={[bannerType === 'error' ? styles.bannerBoxError : bannerType === 'warn' ? styles.bannerBoxWarn : styles.bannerBoxSuccess, bannerOpacityStyle]}>
            <Text style={bannerType === 'error' ? styles.bannerTextError : bannerType === 'warn' ? styles.bannerTextWarn : styles.bannerTextSuccess}>{saveModalMessage}</Text>
          </Animated.View>
        </View>
      ) : null}

      {effectiveMode === 'auth' ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, styles.scrollContentAuth]}>
          <View style={[styles.content, styles.contentAuth]}>
            <View style={styles.authBox}>

            <Text style={{ fontSize: 26, fontWeight: '800', color: '#2f6fed', textAlign: 'center', marginBottom: 4 }}>CheckTécnico</Text>
            <Text style={styles.title}>Login</Text>

            <TextInput
              style={[styles.input, { opacity: 0.7 }]}
              value={authEmail}
              editable={false}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="E-mail"
              placeholderTextColor="#9aa0b5"
              autoComplete="off"
              textContentType="none"
            />
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputWithIcon, { opacity: 0.7 }]}
                value={authPassword}
                editable={false}
                secureTextEntry={!showAuthPassword}
                placeholder="Senha"
                placeholderTextColor="#9aa0b5"
                autoComplete="off"
                textContentType="none"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showAuthPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={styles.inputIconBtn}
                onPress={() => setShowAuthPassword((v) => !v)}
              >
                <Feather name={showAuthPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
              </Pressable>
            </View>
            <View style={styles.authActions}>
              <View style={styles.row}>
                <Pressable style={[styles.btn, isAuthSubmitting && styles.btnDisabled, styles.flex1]} disabled={isAuthSubmitting} onPress={async () => {
                  setIsAuthSubmitting(true);
                  setErrorMessage(null);
                  try {
                    try { await signOut(); } catch {}
                    const loginRes = await signIn({ email: authEmail.trim(), password: authPassword });
                    const u = loginRes?.user;
                    if (u && u.id) {
                      setUserIdState(u.id);
                      try { if (Platform.OS === 'web' && typeof window !== 'undefined') { window.localStorage.setItem('sessionStartedAt', String(Date.now())); window.localStorage.setItem('sessionUserId', u.id); } } catch {}
                      try {
                        const p = await getProfile(u.id);
                        const nm = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
                        setUserName(nm || p?.first_name || null);
                      } catch {}
                      setErrorMessage(null);
                      if (Platform.OS === 'web') {
                        setTimeout(() => {
                          window.history.pushState({}, '', '/home');
                          setRoute('/home');
                          setMode('editor');
                        }, 80);
                      } else {
                        setMode('editor');
                      }
                      await refreshList();
                    } else {
                      setErrorMessage('Não foi possível fazer login.');
                    }
                  } catch (e) {
                    setErrorMessage('Não foi possível fazer login.');
                  } finally { setIsAuthSubmitting(false); }
                }}>
                  {isAuthSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Entrar</Text>
                  )}
                </Pressable>
              </View>
            </View>
            </View>
          </View>
        </ScrollView>
      ) : effectiveMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Checklists</Text>
            {Object.keys(groupedMonths).length === 0 && (
              <Text style={styles.emptyListText}>Nenhum checklist pra exibir ainda.</Text>
            )}
            {Object.entries(groupedMonths).map(([key, group]) => (
              <Section
                key={key}
                title={group.label}
                expanded={!!expandedMonths[key]}
                onToggle={() => setExpandedMonths((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
              <View style={styles.mt4}>
                  {group.items.map((it) => (
                    <View key={it.id} style={styles.listItem}>
                    <Pressable style={styles.flex1} onPress={() => loadChecklist(it.id)}>
                        <Text style={styles.listItemTitle} numberOfLines={1} ellipsizeMode="tail">{it.nome || 'Sem nome'}</Text>
                        <Text style={styles.listItemSub}>{new Date(it.created_at).toLocaleDateString('pt-BR')} • {new Date(it.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </Pressable>
                      <Pressable style={[styles.btnSecondary, styles.btnInlineSm]} disabled={isExporting && exportingId === it.id} onPress={() => onExportPdfItem(it.id)}>
                        <View style={styles.centered}>
                          {isExporting && exportingId === it.id ? (
                            <ActivityIndicator color="#2f6fed" style={styles.absolute} />
                          ) : null}
                          <Text style={[styles.btnSecondaryText, isExporting && exportingId === it.id ? styles.opacity0 : null]}>Exportar</Text>
                        </View>
                      </Pressable>
                      <Pressable style={[styles.delBtn, styles.btnInlineSm]} onPress={() => onDeleteRequest(it.id)}>
                        <Text style={styles.delBtnText}>Deletar</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </Section>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
        {}

          <Section
            title="1️⃣ Dados do cliente"
            expanded={expanded.cliente}
            onToggle={() => setExpanded((e) => ({ ...e, cliente: !e.cliente }))}
          >
            <Text style={styles.label}>👤 Nome completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#9aa0b5"
              value={form.nome}
              onChangeText={(t) => setField('nome', toTitleCase(sanitizeNameInput(t)))}
              maxLength={50}
              keyboardType="default"
              autoCapitalize="words"
              textContentType="name"
              autoCorrect={false}
              spellCheck={false}
            />

            <View style={[styles.rowSpaceBetween, { marginTop: 4, marginBottom: 6 }]}>
              <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>🏠 Endereço</Text>
              <Pressable onPress={preencherEndereco} disabled={isLocating} hitSlop={8}>
                {isLocating && locatingKey === 'endereco' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#2f6fed" />
                    <Text style={{ color: '#2f6fed', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>Carregando...</Text>
                  </View>
                ) : (
                  <Text style={{ color: '#2f6fed', fontWeight: '700', fontSize: 13 }}>📍 Usar localização atual</Text>
                )}
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Rua, número - bairro, cidade"
              placeholderTextColor="#9aa0b5"
              value={form.endereco}
              onChangeText={(t) => setField('endereco', t)}
              maxLength={120}
            />
          </Section>

          <Section
            title="2️⃣ CTO / rede externa"
            expanded={expanded.cto}
            onToggle={() => setExpanded((e) => ({ ...e, cto: !e.cto }))}
          >
            <Text style={styles.label}>📍 Localização da CTO (link do Maps)</Text>
            <View style={styles.flex1}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputInline,
                  styles.flex1,
                  form.locCtoLink ? styles.inputLinkReady : null,
                  Platform.OS === 'web' && form.locCtoLink ? styles.pointerCursor : null,
                ]}
                placeholder="https://www.google.com/maps?..."
                placeholderTextColor="#9aa0b5"
                value={form.locCtoLink}
                onChangeText={() => {}}
                editable={Platform.OS === 'web' ? false : true}
                showSoftInputOnFocus={Platform.OS === 'web' ? undefined : false}
                selectTextOnFocus={false}
                caretHidden
                ref={locCtoRef}
                onFocus={() => {
                  try { locCtoRef.current?.blur(); } catch {}
                  if (form.locCtoLink) {
                    if (Platform.OS === 'web') {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locCtoLink, '_blank', 'noopener,noreferrer'); }
                    } else {
                      Alert.alert('Abrir no Maps', 'Deseja abrir o link no Google Maps?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Abrir', onPress: () => Linking.openURL(form.locCtoLink) },
                      ]);
                    }
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <View style={styles.rowSpaceBetween}>
              <Pressable style={[styles.btn, styles.btnInlineFluid]} onPress={() => useCurrentLocation('locCtoLink')} disabled={isLocating}>
              <View style={styles.centered}>
                  {isLocating && locatingKey === 'locCtoLink' ? (
                <ActivityIndicator color="#fff" style={styles.absolute} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locCtoLink' ? styles.opacity0 : null]}>Capturar localização</Text>
                </View>
              </Pressable>
            </View>

            <Text style={styles.label}>📸 Foto da CTO</Text>
            {form.fotoCto || form.fotoCtoDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoCto || form.fotoCtoDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoCto: null, fotoCtoDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, styles.mb12]} onPress={() => askCameraAndPick('fotoCto')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🎨 Cor da fibra</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Amarela, Azul..."
              placeholderTextColor="#9aa0b5"
              value={form.corFibra}
              onChangeText={(t) => setField('corFibra', toTitleCase(sanitizeNameInput(t)))}
              maxLength={20}
              keyboardType="default"
              autoCapitalize="words"
              textContentType="none"
              autoCorrect={false}
              spellCheck={false}
            />

            <Text style={styles.label}>🔀 Possui splitter?</Text>
            <ToggleYesNo value={form.possuiSplitter} onChange={(v) => setField('possuiSplitter', v)} />

            <Text style={styles.label}>🔌 Número da porta utilizada pelo cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Porta"
              placeholderTextColor="#9aa0b5"
              value={form.portaCliente}
              onChangeText={(t) => setField('portaCliente', t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={8}
            />
          </Section>

          <Section
            title="3️⃣ Casa do cliente"
            expanded={expanded.casa}
            onToggle={() => setExpanded((e) => ({ ...e, casa: !e.casa }))}
          >
            <Text style={styles.label}>📍 Localização da casa (link do Maps)</Text>
            <View style={styles.flex1}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputInline,
                  styles.flex1,
                  form.locCasaLink ? styles.inputLinkReady : null,
                  Platform.OS === 'web' && form.locCasaLink ? styles.pointerCursor : null,
                ]}
                placeholder="https://www.google.com/maps?..."
                placeholderTextColor="#9aa0b5"
                value={form.locCasaLink}
                onChangeText={() => {}}
                editable={Platform.OS === 'web' ? false : true}
                showSoftInputOnFocus={Platform.OS === 'web' ? undefined : false}
                selectTextOnFocus={false}
                caretHidden
                ref={locCasaRef}
                onFocus={() => {
                  try { locCasaRef.current?.blur(); } catch {}
                  if (form.locCasaLink) {
                    if (Platform.OS === 'web') {
                      const ok = window.confirm('Abrir o link no Google Maps?');
                      if (ok) { window.open(form.locCasaLink, '_blank', 'noopener,noreferrer'); }
                    } else {
                      Alert.alert('Abrir no Maps', 'Deseja abrir o link no Google Maps?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Abrir', onPress: () => Linking.openURL(form.locCasaLink) },
                      ]);
                    }
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
            <View style={styles.rowSpaceBetween}>
              <Pressable style={[styles.btn, styles.btnInlineFluid]} onPress={() => useCurrentLocation('locCasaLink')} disabled={isLocating}>
              <View style={styles.centered}>
                  {isLocating && locatingKey === 'locCasaLink' ? (
                <ActivityIndicator color="#fff" style={styles.absolute} />
                  ) : null}
                  <Text style={[styles.btnText, isLocating && locatingKey === 'locCasaLink' ? styles.opacity0 : null]}>Capturar localização</Text>
                </View>
              </Pressable>
            </View>

            <Text style={styles.label}>🏘 Foto da frente da casa</Text>
            {form.fotoFrenteCasa || form.fotoFrenteCasaDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoFrenteCasa || form.fotoFrenteCasaDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoFrenteCasa: null, fotoFrenteCasaDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, styles.mb12]} onPress={() => askCameraAndPick('fotoFrenteCasa')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>
          </Section>

          <Section
            title="4️⃣ Instalação interna"
            expanded={expanded.interna}
            onToggle={() => setExpanded((e) => ({ ...e, interna: !e.interna }))}
          >
            <Text style={styles.label}>🧰 Foto da instalação do equipamento (ONT/Router)</Text>
            {form.fotoInstalacao || form.fotoInstalacaoDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoInstalacao || form.fotoInstalacaoDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoInstalacao: null, fotoInstalacaoDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, styles.mb12]} onPress={() => askCameraAndPick('fotoInstalacao')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>🏷 Foto do MAC do equipamento</Text>
            {form.fotoMacEquip || form.fotoMacEquipDataUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: form.fotoMacEquip || form.fotoMacEquipDataUri }} style={styles.image} resizeMode="cover" />
                <Pressable style={styles.closeBadge} onPress={() => setForm({ ...form, fotoMacEquip: null, fotoMacEquipDataUri: null })}>
                  <Text style={styles.closeBadgeText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={[styles.btn, styles.btnCapture, styles.mb12]} onPress={() => askCameraAndPick('fotoMacEquip')}>
              <Text style={styles.btnText}>Capturar/Selecionar Foto</Text>
            </Pressable>

            <Text style={styles.label}>💡 Nome do Wi-Fi</Text>
            <TextInput
              style={styles.input}
              placeholder="SSID"
              placeholderTextColor="#9aa0b5"
              value={form.nomeWifi}
              onChangeText={(t) => setField('nomeWifi', t)}
              autoComplete="off"
              textContentType="none"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              maxLength={32}
            />

            <Text style={styles.label}>🔑 Senha do Wi-Fi</Text>
            <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Senha"
              placeholderTextColor="#9aa0b5"
              secureTextEntry={!showWifiPassword}
              value={form.senhaWifi}
              onChangeText={(t) => setField('senhaWifi', t)}
              autoComplete="off"
              textContentType="oneTimeCode"
              autoCorrect={false}
              spellCheck={false}
              ref={senhaWifiRef}
              maxLength={32}
            />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showWifiPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={styles.inputIconBtn}
                onPress={() => setShowWifiPassword((v) => !v)}
              >
                <Feather name={showWifiPassword ? 'eye' : 'eye-off'} size={16} color="#666" />
              </Pressable>
            </View>
          </Section>

          <Section
            title="5️⃣ Finalização"
            expanded={expanded.finalizacao}
            onToggle={() => setExpanded((e) => ({ ...e, finalizacao: !e.finalizacao }))}
          >
            <Text style={styles.label}>🌐 Teste de navegação realizado com sucesso?</Text>
            <ToggleYesNo value={form.testeNavegacaoOk} onChange={(v) => setField('testeNavegacaoOk', v)} />

            <Text style={styles.label}>📞 Cliente ciente e satisfeito com o serviço?</Text>
            <ToggleYesNo value={form.clienteSatisfeito} onChange={(v) => setField('clienteSatisfeito', v)} />
          </Section>

          <View />
          <View style={styles.btnGroup}>
            <Pressable
              style={[
                styles.btn,
                styles.wFull,
                (isSaving || !canSubmit) && styles.btnDisabled,
              ]}
              onPress={onSave}
              disabled={isSaving || !canSubmit}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>{actionLabel}</Text>
              )}
            </Pressable>

            {currentId ? (
              <Pressable
                style={[styles.btnSecondary, styles.wFull]}
                onPress={onExportPdf}
              >
                <Text style={styles.btnSecondaryText}>Exportar PDF</Text>
              </Pressable>
            ) : null}

            {(hasChanges && (!currentId || Platform.OS === 'web')) ? (
              <Pressable
                style={[styles.btnSecondary, styles.wFull]}
                onPress={() => {
                  resetUIForNew();
                  setCurrentId(null);
                  if (Platform.OS === 'web') {
                    window.history.pushState({}, '', '/home');
                    setRoute('/home');
                    setMode('editor');
                  } else {
                    setMode('editor');
                  }
                }}
              >
                <Text style={styles.btnSecondaryText}>Limpar Campos</Text>
              </Pressable>
            ) : null}

            {currentId ? (
              <Pressable
                style={[styles.btnSecondary, styles.wFull]}
                onPress={() => {
                  resetUIForNew();
                  setCurrentId(null);
                  if (Platform.OS === 'web') {
                    window.history.pushState({}, '', '/home');
                    setRoute('/home');
                    setMode('editor');
                  } else {
                    setMode('editor');
                  }
                }}
              >
                <Text style={styles.btnSecondaryText}>Novo Checklist</Text>
              </Pressable>
            ) : null}

            {currentId ? (
              <Pressable
                style={[styles.btnDanger, styles.wFull]}
                onPress={() => onDeleteRequest(currentId)}
              >
                <Text style={styles.btnText}>Deletar Checklist</Text>
              </Pressable>
            ) : null}
          </View>

          {null}

          <View style={styles.spacer24} />
        </View>
        </ScrollView>
      )}
      
      <StatusBar style="auto" />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}
