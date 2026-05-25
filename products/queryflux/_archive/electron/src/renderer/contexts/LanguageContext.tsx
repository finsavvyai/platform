import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ar' | 'he' | 'hi';

interface Translation {
  [key: string]: string | Translation;
}

const translations: Record<Language, Translation> = {
  en: {
    nav: {
      connections: 'Connections',
      queries: 'Queries',
      monitoring: 'Monitoring',
      settings: 'Settings',
      configureConnection: 'Configure connection'
    },
    database: {
      welcome: 'Welcome to QueryFlux',
      newDatabaseConnection: 'New Database Connection',
      connectTo: 'Connect to',
      selectType: 'Select database type',
      connectionName: 'Connection Name',
      host: 'Host',
      port: 'Port',
      database: 'Database',
      username: 'Username',
      password: 'Password',
      ssl: 'SSL/TLS',
      testConnection: 'Test Connection',
      connect: 'Connect',
      disconnect: 'Disconnect',
      saveConnection: 'Save Connection',
      editConnection: 'Edit Connection',
      deleteConnection: 'Delete Connection',
      connectionSuccess: 'Connection successful',
      connectionFailed: 'Connection failed'
    },
    query: {
      editor: 'Query Editor',
      execute: 'Execute',
      explain: 'Explain',
      save: 'Save',
      history: 'History',
      results: 'Results',
      noResults: 'No results to display',
      querySuccess: 'Query executed successfully',
      queryFailed: 'Query execution failed'
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      update: 'Update',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info'
    }
  },
  es: {
    nav: {
      connections: 'Conexiones',
      queries: 'Consultas',
      monitoring: 'Monitoreo',
      settings: 'Configuración',
      configureConnection: 'Configurar conexión'
    },
    database: {
      welcome: 'Bienvenido a QueryFlux',
      newDatabaseConnection: 'Nueva Conexión de Base de Datos',
      connectTo: 'Conectar a',
      selectType: 'Seleccionar tipo de base de datos',
      connectionName: 'Nombre de Conexión',
      host: 'Host',
      port: 'Puerto',
      database: 'Base de Datos',
      username: 'Usuario',
      password: 'Contraseña',
      ssl: 'SSL/TLS',
      testConnection: 'Probar Conexión',
      connect: 'Conectar',
      disconnect: 'Desconectar',
      saveConnection: 'Guardar Conexión',
      editConnection: 'Editar Conexión',
      deleteConnection: 'Eliminar Conexión',
      connectionSuccess: 'Conexión exitosa',
      connectionFailed: 'Conexión fallida'
    },
    query: {
      editor: 'Editor de Consultas',
      execute: 'Ejecutar',
      explain: 'Explicar',
      save: 'Guardar',
      history: 'Historial',
      results: 'Resultados',
      noResults: 'No hay resultados para mostrar',
      querySuccess: 'Consulta ejecutada exitosamente',
      queryFailed: 'Falló la ejecución de la consulta'
    },
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      create: 'Crear',
      update: 'Actualizar',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      warning: 'Advertencia',
      info: 'Información'
    }
  },
  fr: {
    nav: {
      connections: 'Connexions',
      queries: 'Requêtes',
      monitoring: 'Surveillance',
      settings: 'Paramètres',
      configureConnection: 'Configurer la connexion'
    },
    database: {
      welcome: 'Bienvenue dans QueryFlux',
      newDatabaseConnection: 'Nouvelle Connexion de Base de Données',
      connectTo: 'Se connecter à',
      selectType: 'Sélectionner le type de base de données',
      connectionName: 'Nom de la Connexion',
      host: 'Hôte',
      port: 'Port',
      database: 'Base de Données',
      username: 'Nom d\'utilisateur',
      password: 'Mot de passe',
      ssl: 'SSL/TLS',
      testConnection: 'Tester la Connexion',
      connect: 'Connecter',
      disconnect: 'Déconnecter',
      saveConnection: 'Sauvegarder la Connexion',
      editConnection: 'Modifier la Connexion',
      deleteConnection: 'Supprimer la Connexion',
      connectionSuccess: 'Connexion réussie',
      connectionFailed: 'Connexion échouée'
    },
    query: {
      editor: 'Éditeur de Requête',
      execute: 'Exécuter',
      explain: 'Expliquer',
      save: 'Sauvegarder',
      history: 'Historique',
      results: 'Résultats',
      noResults: 'Aucun résultat à afficher',
      querySuccess: 'Requête exécutée avec succès',
      queryFailed: 'Échec de l\'exécution de la requête'
    },
    common: {
      save: 'Sauvegarder',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      create: 'Créer',
      update: 'Mettre à jour',
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      warning: 'Avertissement',
      info: 'Information'
    }
  },
  de: {
    nav: {
      connections: 'Verbindungen',
      queries: 'Abfragen',
      monitoring: 'Überwachung',
      settings: 'Einstellungen',
      configureConnection: 'Verbindung konfigurieren'
    },
    database: {
      welcome: 'Willkommen bei QueryFlux',
      newDatabaseConnection: 'Neue Datenbankverbindung',
      connectTo: 'Verbinden mit',
      selectType: 'Datenbanktyp auswählen',
      connectionName: 'Verbindungsname',
      host: 'Host',
      port: 'Port',
      database: 'Datenbank',
      username: 'Benutzername',
      password: 'Passwort',
      ssl: 'SSL/TLS',
      testConnection: 'Verbindung testen',
      connect: 'Verbinden',
      disconnect: 'Trennen',
      saveConnection: 'Verbindung speichern',
      editConnection: 'Verbindung bearbeiten',
      deleteConnection: 'Verbindung löschen',
      connectionSuccess: 'Verbindung erfolgreich',
      connectionFailed: 'Verbindung fehlgeschlagen'
    },
    query: {
      editor: 'Abfrage-Editor',
      execute: 'Ausführen',
      explain: 'Erklären',
      save: 'Speichern',
      history: 'Verlauf',
      results: 'Ergebnisse',
      noResults: 'Keine Ergebnisse zum Anzeigen',
      querySuccess: 'Abfrage erfolgreich ausgeführt',
      queryFailed: 'Abfrage-Ausführung fehlgeschlagen'
    },
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      create: 'Erstellen',
      update: 'Aktualisieren',
      loading: 'Laden...',
      error: 'Fehler',
      success: 'Erfolg',
      warning: 'Warnung',
      info: 'Information'
    }
  },
  it: {
    nav: {
      connections: 'Connessioni',
      queries: 'Query',
      monitoring: 'Monitoraggio',
      settings: 'Impostazioni',
      configureConnection: 'Configura connessione'
    },
    database: {
      welcome: 'Benvenuto in QueryFlux',
      newDatabaseConnection: 'Nuova Connessione Database',
      connectTo: 'Connetti a',
      selectType: 'Seleziona tipo database',
      connectionName: 'Nome Connessione',
      host: 'Host',
      port: 'Porta',
      database: 'Database',
      username: 'Username',
      password: 'Password',
      ssl: 'SSL/TLS',
      testConnection: 'Testa Connessione',
      connect: 'Connetti',
      disconnect: 'Disconnetti',
      saveConnection: 'Salva Connessione',
      editConnection: 'Modifica Connessione',
      deleteConnection: 'Elimina Connessione',
      connectionSuccess: 'Connessione riuscita',
      connectionFailed: 'Connessione fallita'
    },
    query: {
      editor: 'Editor Query',
      execute: 'Esegui',
      explain: 'Spiega',
      save: 'Salva',
      history: 'Cronologia',
      results: 'Risultati',
      noResults: 'Nessun risultato da mostrare',
      querySuccess: 'Query eseguita con successo',
      queryFailed: 'Esecuzione query fallita'
    },
    common: {
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      edit: 'Modifica',
      create: 'Crea',
      update: 'Aggiorna',
      loading: 'Caricamento...',
      error: 'Errore',
      success: 'Successo',
      warning: 'Avvertimento',
      info: 'Informazione'
    }
  },
  pt: {
    nav: {
      connections: 'Conexões',
      queries: 'Consultas',
      monitoring: 'Monitoramento',
      settings: 'Configurações',
      configureConnection: 'Configurar conexão'
    },
    database: {
      welcome: 'Bem-vindo ao QueryFlux',
      newDatabaseConnection: 'Nova Conexão de Banco de Dados',
      connectTo: 'Conectar a',
      selectType: 'Selecionar tipo de banco de dados',
      connectionName: 'Nome da Conexão',
      host: 'Host',
      port: 'Porta',
      database: 'Banco de Dados',
      username: 'Usuário',
      password: 'Senha',
      ssl: 'SSL/TLS',
      testConnection: 'Testar Conexão',
      connect: 'Conectar',
      disconnect: 'Desconectar',
      saveConnection: 'Salvar Conexão',
      editConnection: 'Editar Conexão',
      deleteConnection: 'Excluir Conexão',
      connectionSuccess: 'Conexão bem-sucedida',
      connectionFailed: 'Falha na conexão'
    },
    query: {
      editor: 'Editor de Consulta',
      execute: 'Executar',
      explain: 'Explicar',
      save: 'Salvar',
      history: 'Histórico',
      results: 'Resultados',
      noResults: 'Nenhum resultado para exibir',
      querySuccess: 'Consulta executada com sucesso',
      queryFailed: 'Falha na execução da consulta'
    },
    common: {
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      edit: 'Editar',
      create: 'Criar',
      update: 'Atualizar',
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso',
      warning: 'Aviso',
      info: 'Informação'
    }
  },
  ru: {
    nav: {
      connections: 'Соединения',
      queries: 'Запросы',
      monitoring: 'Мониторинг',
      settings: 'Настройки',
      configureConnection: 'Настроить соединение'
    },
    database: {
      welcome: 'Добро пожаловать в QueryFlux',
      newDatabaseConnection: 'Новое Подключение к Базе Данных',
      connectTo: 'Подключиться к',
      selectType: 'Выберите тип базы данных',
      connectionName: 'Имя Подключения',
      host: 'Хост',
      port: 'Порт',
      database: 'База Данных',
      username: 'Имя пользователя',
      password: 'Пароль',
      ssl: 'SSL/TLS',
      testConnection: 'Проверить Соединение',
      connect: 'Подключиться',
      disconnect: 'Отключиться',
      saveConnection: 'Сохранить Подключение',
      editConnection: 'Редактировать Подключение',
      deleteConnection: 'Удалить Подключение',
      connectionSuccess: 'Соединение успешно',
      connectionFailed: 'Соединение не удалось'
    },
    query: {
      editor: 'Редактор Запросов',
      execute: 'Выполнить',
      explain: 'Объяснить',
      save: 'Сохранить',
      history: 'История',
      results: 'Результаты',
      noResults: 'Нет результатов для отображения',
      querySuccess: 'Запрос выполнен успешно',
      queryFailed: 'Выполнение запроса не удалось'
    },
    common: {
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      create: 'Создать',
      update: 'Обновить',
      loading: 'Загрузка...',
      error: 'Ошибка',
      success: 'Успех',
      warning: 'Предупреждение',
      info: 'Информация'
    }
  },
  zh: {
    nav: {
      connections: '连接',
      queries: '查询',
      monitoring: '监控',
      settings: '设置',
      configureConnection: '配置连接'
    },
    database: {
      welcome: '欢迎使用 QueryFlux',
      newDatabaseConnection: '新建数据库连接',
      connectTo: '连接到',
      selectType: '选择数据库类型',
      connectionName: '连接名称',
      host: '主机',
      port: '端口',
      database: '数据库',
      username: '用户名',
      password: '密码',
      ssl: 'SSL/TLS',
      testConnection: '测试连接',
      connect: '连接',
      disconnect: '断开连接',
      saveConnection: '保存连接',
      editConnection: '编辑连接',
      deleteConnection: '删除连接',
      connectionSuccess: '连接成功',
      connectionFailed: '连接失败'
    },
    query: {
      editor: '查询编辑器',
      execute: '执行',
      explain: '解释',
      save: '保存',
      history: '历史',
      results: '结果',
      noResults: '无结果显示',
      querySuccess: '查询执行成功',
      queryFailed: '查询执行失败'
    },
    common: {
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      create: '创建',
      update: '更新',
      loading: '加载中...',
      error: '错误',
      success: '成功',
      warning: '警告',
      info: '信息'
    }
  },
  ja: {
    nav: {
      connections: '接続',
      queries: 'クエリ',
      monitoring: 'モニタリング',
      settings: '設定',
      configureConnection: '接続を設定'
    },
    database: {
      welcome: 'QueryFlux へようこそ',
      newDatabaseConnection: '新しいデータベース接続',
      connectTo: '接続先',
      selectType: 'データベースタイプを選択',
      connectionName: '接続名',
      host: 'ホスト',
      port: 'ポート',
      database: 'データベース',
      username: 'ユーザー名',
      password: 'パスワード',
      ssl: 'SSL/TLS',
      testConnection: '接続テスト',
      connect: '接続',
      disconnect: '切断',
      saveConnection: '接続を保存',
      editConnection: '接続を編集',
      deleteConnection: '接続を削除',
      connectionSuccess: '接続成功',
      connectionFailed: '接続失敗'
    },
    query: {
      editor: 'クエリエディタ',
      execute: '実行',
      explain: '説明',
      save: '保存',
      history: '履歴',
      results: '結果',
      noResults: '表示する結果がありません',
      querySuccess: 'クエリが正常に実行されました',
      queryFailed: 'クエリの実行に失敗しました'
    },
    common: {
      save: '保存',
      cancel: 'キャンセル',
      delete: '削除',
      edit: '編集',
      create: '作成',
      update: '更新',
      loading: '読み込み中...',
      error: 'エラー',
      success: '成功',
      warning: '警告',
      info: '情報'
    }
  },
  ar: {
    nav: {
      connections: 'الاتصالات',
      queries: 'الاستعلامات',
      monitoring: 'المراقبة',
      settings: 'الإعدادات',
      configureConnection: 'تكوين الاتصال'
    },
    database: {
      welcome: 'مرحباً بك في QueryFlux',
      newDatabaseConnection: 'اتصال قاعدة بيانات جديد',
      connectTo: 'الاتصال بـ',
      selectType: 'اختر نوع قاعدة البيانات',
      connectionName: 'اسم الاتصال',
      host: 'المضيف',
      port: 'المنفذ',
      database: 'قاعدة البيانات',
      username: 'اسم المستخدم',
      password: 'كلمة المرور',
      ssl: 'SSL/TLS',
      testConnection: 'اختبار الاتصال',
      connect: 'اتصال',
      disconnect: 'قطع الاتصال',
      saveConnection: 'حفظ الاتصال',
      editConnection: 'تحرير الاتصال',
      deleteConnection: 'حذف الاتصال',
      connectionSuccess: 'تم الاتصال بنجاح',
      connectionFailed: 'فشل الاتصال'
    },
    query: {
      editor: 'محرر الاستعلام',
      execute: 'تنفيذ',
      explain: 'شرح',
      save: 'حفظ',
      history: 'السجل',
      results: 'النتائج',
      noResults: 'لا توجد نتائج لعرضها',
      querySuccess: 'تم تنفيذ الاستعلام بنجاح',
      queryFailed: 'فشل تنفيذ الاستعلام'
    },
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تحرير',
      create: 'إنشاء',
      update: 'تحديث',
      loading: 'جاري التحميل...',
      error: 'خطأ',
      success: 'نجح',
      warning: 'تحذير',
      info: 'معلومات'
    }
  },
  he: {
    nav: {
      connections: 'חיבורים',
      queries: 'שאילתות',
      monitoring: 'מעקב',
      settings: 'הגדרות',
      configureConnection: 'הגדר חיבור'
    },
    database: {
      welcome: 'ברוכים הבאים ל-QueryFlux',
      newDatabaseConnection: 'חיבור מסד נתונים חדש',
      connectTo: 'התחבר אל',
      selectType: 'בחר סוג מסד נתונים',
      connectionName: 'שם חיבור',
      host: 'מארח',
      port: 'פורט',
      database: 'מסד נתונים',
      username: 'שם משתמש',
      password: 'סיסמה',
      ssl: 'SSL/TLS',
      testConnection: 'בדוק חיבור',
      connect: 'התחבר',
      disconnect: 'התנתק',
      saveConnection: 'שמור חיבור',
      editConnection: 'ערוך חיבור',
      deleteConnection: 'מחק חיבור',
      connectionSuccess: 'החיבור הצליח',
      connectionFailed: 'החיבור נכשל'
    },
    query: {
      editor: 'עורך שאילתות',
      execute: 'בצע',
      explain: 'הסבר',
      save: 'שמור',
      history: 'היסטוריה',
      results: 'תוצאות',
      noResults: 'אין תוצאות להצגה',
      querySuccess: 'השאילתה בוצעה בהצלחה',
      queryFailed: 'ביצוע השאילתה נכשל'
    },
    common: {
      save: 'שמור',
      cancel: 'בטל',
      delete: 'מחק',
      edit: 'ערוך',
      create: 'צור',
      update: 'עדכן',
      loading: 'טוען...',
      error: 'שגיאה',
      success: 'הצלחה',
      warning: 'אזהרה',
      info: 'מידע'
    }
  },
  hi: {
    nav: {
      connections: 'कनेक्शन्स',
      queries: 'क्वेरीज़',
      monitoring: 'मॉनिटरिंग',
      settings: 'सेटिंग्स',
      configureConnection: 'कनेक्शन कॉन्फ़िगर करें'
    },
    database: {
      welcome: 'QueryFlux में आपका स्वागत है',
      newDatabaseConnection: 'नया डेटाबेस कनेक्शन',
      connectTo: 'से कनेक्ट हों',
      selectType: 'डेटाबेस प्रकार चुनें',
      connectionName: 'कनेक्शन का नाम',
      host: 'होस्ट',
      port: 'पोर्ट',
      database: 'डेटाबेस',
      username: 'उपयोगकर्ता नाम',
      password: 'पासवर्ड',
      ssl: 'SSL/TLS',
      testConnection: 'कनेक्शन टेस्ट करें',
      connect: 'कनेक्ट करें',
      disconnect: 'डिस्कनेक्ट करें',
      saveConnection: 'कनेक्शन सेव करें',
      editConnection: 'कनेक्शन एडिट करें',
      deleteConnection: 'कनेक्शन डिलीट करें',
      connectionSuccess: 'कनेक्शन सफल',
      connectionFailed: 'कनेक्शन विफल'
    },
    query: {
      editor: 'क्वेरी एडिटर',
      execute: 'निष्पादित करें',
      explain: 'स्पष्ट करें',
      save: 'सेव करें',
      history: 'इतिहास',
      results: 'परिणाम',
      noResults: 'दिखाने के लिए कोई परिणाम नहीं',
      querySuccess: 'क्वेरी सफलतापूर्वक निष्पादित हुई',
      queryFailed: 'क्वेरी निष्पादन विफल रहा'
    },
    common: {
      save: 'सेव करें',
      cancel: 'रद्द करें',
      delete: 'डिलीट करें',
      edit: 'एडिट करें',
      create: 'बनाएं',
      update: 'अपडेट करें',
      loading: 'लोड हो रहा है...',
      error: 'त्रुटि',
      success: 'सफलता',
      warning: 'चेतावनी',
      info: 'जानकारी'
    }
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  availableLanguages: { code: Language; name: string; nativeName: string }[];
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  defaultLanguage = 'en'
}) => {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('queryflux-language', newLanguage);
    }
  };

  // Get nested translation value by key path (e.g., 'database.connectionName')
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return key if not found
          }
        }
      }
    }

    return typeof value === 'string' ? value : key;
  };

  const isRTL = ['ar', 'he'].includes(language);

  useEffect(() => {
    // Load language from localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedLanguage = localStorage.getItem('queryflux-language') as Language;
      if (savedLanguage && translations[savedLanguage]) {
        setLanguageState(savedLanguage);
      }
    }
  }, []);

  const availableLanguages = [
    { code: 'en' as Language, name: 'English', nativeName: 'English' },
    { code: 'es' as Language, name: 'Spanish', nativeName: 'Español' },
    { code: 'fr' as Language, name: 'French', nativeName: 'Français' },
    { code: 'de' as Language, name: 'German', nativeName: 'Deutsch' },
    { code: 'it' as Language, name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt' as Language, name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru' as Language, name: 'Russian', nativeName: 'Русский' },
    { code: 'zh' as Language, name: 'Chinese', nativeName: '中文' },
    { code: 'ja' as Language, name: 'Japanese', nativeName: '日本語' },
    { code: 'ar' as Language, name: 'Arabic', nativeName: 'العربية' },
    { code: 'he' as Language, name: 'Hebrew', nativeName: 'עברית' },
    { code: 'hi' as Language, name: 'Hindi', nativeName: 'हिन्दी' },
  ];

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    availableLanguages,
    isRTL,
  };

  return (
    <LanguageContext.Provider value={value}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl-layout' : 'ltr-layout'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};
