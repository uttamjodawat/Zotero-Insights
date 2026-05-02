import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  BookOpen, Clock, CheckCircle, BarChart3, Settings, 
  Library, User, LogOut, ChevronRight, Search, 
  Plus, ExternalLink, Calendar, Filter, RefreshCw, Cpu, Database, X, Tag, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoteroItem, ZoteroCollection, AuthPayload } from './types';

// IndexedDB Helper
const IDB_NAME = 'ZoteroInsightDB';
const IDB_STORE = 'items';

const saveToIDB = async (items: any[]) => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(items, 'current_items');
        tx.oncomplete = () => resolve(true);
      };
      request.onerror = () => resolve(false);
    } catch (e) {
      console.error('IDB Save Fail', e);
      resolve(false);
    }
  });
};

const getFromIDB = async (): Promise<any[]> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get('current_items');
        getReq.onsuccess = () => resolve(getReq.result || []);
        getReq.onerror = () => resolve([]);
      };
      request.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
};

// High Density theme colors
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#3b82f6', '#64748b'];

export default function App() {
  return (
    <ZoteroReader />
  );
}

function ZoteroReader() {
  const [auth, setAuth] = useState<AuthPayload | null>(() => {
    const saved = localStorage.getItem('zotero_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [items, setItems] = useState<ZoteroItem[]>([]);
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);
  
  // Initial load from IDB
  useEffect(() => {
    const initData = async () => {
      try {
        const savedItems = await getFromIDB();
        if (savedItems && savedItems.length > 0) {
          setItems(savedItems);
        } else {
          // Fallback to localStorage if tiny
          const legacyItems = localStorage.getItem('zotero_items');
          if (legacyItems) {
            try {
              setItems(JSON.parse(legacyItems));
            } catch (e) { console.error(e); }
          }
        }
      } catch (e) {
        console.error('IDB Init Error:', e);
      } finally {
        setHasAttemptedRestore(true);
      }
    };
    initData();
  }, []);

  const [collections, setCollections] = useState<ZoteroCollection[]>(() => {
    const saved = localStorage.getItem('zotero_collections');
    return saved ? JSON.parse(saved) : [];
  });
  const isLocalSession = useMemo(() => {
    return auth?.token === 'local';
  }, [auth]);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library'>('dashboard');
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'overall'>('monthly');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'reading' | 'queue' | 'read'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'dateModified', direction: 'desc' });
  const [isLiveSync, setIsLiveSync] = useState(() => localStorage.getItem('zotero_live_sync') === 'true');
  const [showDirectKeyForm, setShowDirectKeyForm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [libraryVersion, setLibraryVersion] = useState(() => localStorage.getItem('zotero_library_version') || '0');
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const [tagConfig, setTagConfig] = useState(() => {
    const saved = localStorage.getItem('zotero_tag_config');
    return saved ? JSON.parse(saved) : {
      reading: 'reading',
      queue: 'queue',
      read: 'read'
    };
  });

  const [directKeyData, setDirectKeyData] = useState({ userID: '', apiKey: '', libraryType: 'user' as 'user' | 'group' });
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [loadStats, setLoadStats] = useState({ current: 0, total: 0 });

  // Persistence Hook
  useEffect(() => {
    try {
      if (auth) {
        localStorage.setItem('zotero_auth', JSON.stringify(auth));
      } else {
        localStorage.removeItem('zotero_auth');
      }
      
      localStorage.setItem('zotero_session_type', isLocalSession ? 'local' : 'cloud');
      localStorage.setItem('zotero_live_sync', String(isLiveSync));
      
      if (collections.length > 0) {
        localStorage.setItem('zotero_collections', JSON.stringify(collections));
      } else {
        localStorage.setItem('zotero_collections', '[]');
      }
      
      if (libraryVersion) {
        localStorage.setItem('zotero_library_version', libraryVersion);
      }

      if (items.length > 0) {
        saveToIDB(items);
        // Clear legacy huge localStorage if it exists
        if (localStorage.getItem('zotero_items')) {
          localStorage.removeItem('zotero_items');
        }
      }
    } catch (e) {
      console.error('Persistence error:', e);
    }
  }, [auth, items, collections, isLocalSession, isLiveSync, libraryVersion]);

  // Real-time synchronization polling
  useEffect(() => {
    let interval: any;
    if (auth && !isLocalSession && isLiveSync) {
      interval = setInterval(() => {
        fetchData(true);
      }, 1000 * 60 * 15); // Polling every 15 minutes
    }
    return () => clearInterval(interval);
  }, [auth, isLocalSession, isLiveSync]);

  const handleSqliteUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.sqlite')) {
      alert('Please upload your zotero.sqlite file (located in your Zotero data directory).');
      return;
    }

    setIsLoading(true);
    setDbStatus('Initialising SQL Engine...');
    
    try {
      // Import sql.js dynamically
      const initSqlJs = (window as any).initSqlJs;
      if (!initSqlJs) {
        const script = document.createElement('script');
        script.src = 'https://sql.js.org/dist/sql-wasm.js';
        document.head.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }
      
      const SQL = await (window as any).initSqlJs({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      });

      setDbStatus('Reading Database...');
      const arrayBuffer = await file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(arrayBuffer));

      setDbStatus('Extracting Items...');
      // Enhanced items query with collections and reading progress logic
      const itemsQuery = `
        SELECT 
          i.key, 
          it.typeName as itemType,
          (SELECT idv.value FROM itemDataValues idv JOIN itemData id ON id.valueID = idv.valueID JOIN fields f ON f.fieldID = id.fieldID WHERE id.itemID = i.itemID AND f.fieldName = 'title' LIMIT 1) as title,
          (SELECT idv.value FROM itemDataValues idv JOIN itemData id ON id.valueID = idv.valueID JOIN fields f ON f.fieldID = id.fieldID WHERE id.itemID = i.itemID AND f.fieldName = 'publicationTitle' LIMIT 1) as publicationTitle,
          i.dateAdded,
          i.dateModified,
          (SELECT GROUP_CONCAT(t.name, '||') FROM tags t JOIN itemTags itg ON t.tagID = itg.tagID WHERE itg.itemID = i.itemID) as tagList,
          (SELECT GROUP_CONCAT(c.lastName, ', ') FROM creators c JOIN itemCreators ic ON c.creatorID = ic.creatorID WHERE ic.itemID = i.itemID) as creatorList,
          (SELECT i2.key FROM items i2 JOIN itemAttachments ia ON i2.itemID = ia.itemID WHERE ia.parentItemID = i.itemID AND (ia.path LIKE '%.pdf' OR ia.contentType = 'application/pdf') LIMIT 1) as attKey,
          (SELECT COUNT(*) FROM itemAnnotations ia WHERE ia.parentItemID IN (SELECT itemID FROM itemAttachments WHERE parentItemID = i.itemID)) as annotationCount,
          (SELECT MAX(CAST(idv.value AS INT)) FROM itemDataValues idv 
           JOIN itemData id ON id.valueID = idv.valueID 
           JOIN fields f ON f.fieldID = id.fieldID 
           WHERE f.fieldName IN ('page', 'pageLabel', 'annotationPage') 
           AND id.itemID IN (SELECT itemID FROM itemAnnotations WHERE parentItemID IN (SELECT itemID FROM itemAttachments WHERE parentItemID = i.itemID))) as maxPage,
          (SELECT idv.value FROM itemDataValues idv 
           JOIN itemData id ON id.valueID = idv.valueID 
           JOIN fields f ON f.fieldID = id.fieldID 
           WHERE id.itemID IN (SELECT itemID FROM itemAttachments WHERE parentItemID = i.itemID) 
           AND f.fieldName IN ('numPages', 'pages') LIMIT 1) as totalPages,
          (SELECT GROUP_CONCAT(c.collectionName, '||') FROM collections c JOIN collectionItems ci ON c.collectionID = ci.collectionID WHERE ci.itemID = i.itemID) as collectionList
        FROM items i
        INNER JOIN itemTypes it ON i.itemTypeID = it.itemTypeID
        WHERE it.typeName NOT IN ('attachment', 'note', 'annotation')
      `;
      
      const itemsResult = db.exec(itemsQuery);
      
      if (itemsResult.length === 0 || !itemsResult[0].values.length) {
        const typeCheck = db.exec("SELECT typeName, COUNT(*) FROM items i JOIN itemTypes it ON i.itemTypeID = it.itemTypeID GROUP BY typeName");
        const typesList = typeCheck[0]?.values.map(v => `${v[0]}: ${v[1]}`).join(', ') || 'none';
        throw new Error(`Data Mapping Error: No items found. Distribution: ${typesList}`);
      }

      const columns = itemsResult[0].columns;
      const values = itemsResult[0].values;

      const importedItems: any[] = values.map((row: any[]) => {
        const item: any = {};
        columns.forEach((col, idx) => {
          item[col] = row[idx];
        });
        
        const tags = item.tagList ? item.tagList.split('||').map((t: string) => ({ tag: t })) : [];
        const collections = item.collectionList ? item.collectionList.split('||') : [];
        
        // Refined Progress Logic: 100% if "read" tag exists
        const isCompleted = tags.some(t => {
          const clean = (t.tag || '').toLowerCase().replace('#', '');
          return clean === 'read' || clean === 'completed' || clean === 'finished';
        });

        const progressNum = isCompleted 
          ? 100 
          : (item.maxPage && item.totalPages) 
            ? Math.min(99, Math.round((parseInt(item.maxPage) / parseInt(item.totalPages)) * 100)) 
            : 0;

        return {
          key: item.key,
          data: {
            title: item.title || 'Untitled',
            itemType: item.itemType,
            creators: [],
            dateAdded: item.dateAdded,
            dateModified: item.dateModified,
            publicationTitle: item.publicationTitle || '',
            tags: tags
          },
          meta: {
            creatorSummary: item.creatorList || 'Unknown Creator',
            attachmentKey: item.attKey,
            readingProgress: progressNum,
            lastPage: item.maxPage || 0,
            annotationCount: item.annotationCount || 0,
            collections: collections
          }
        };
      });

      setDbStatus('Syncing Collections...');
      const collectionsResult = db.exec("SELECT key, collectionName FROM collections");
      const importedCollections: ZoteroCollection[] = collectionsResult.length > 0 
        ? collectionsResult[0].values.map((row: any[]) => ({
            key: row[0] as string,
            data: { name: row[1] as string }
          }))
        : [];

      setItems(importedItems);
      setCollections(importedCollections);
      setAuth({
        username: 'Local Database User',
        userID: 'local_sqlite',
        token: 'local',
        secret: 'local'
      });
      
      db.close();
      setIsLoading(false);
      setDbStatus('');
    } catch (err) {
      console.error('Database Parse Error:', err);
      setIsLoading(false);
      setDbStatus('');
      alert('Error parsing Zotero Database. Ensure you selected the correct zotero.sqlite file.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const importedItems = Array.isArray(json) ? json : (json.items || []);
        
        setItems(importedItems);
        setCollections([]); 
        setAuth({
          username: 'Local Researcher',
          userID: 'local',
          token: 'local',
          secret: 'local'
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Invalid JSON file', err);
        setIsLoading(false);
        alert('Could not parse Zotero JSON. Please ensure it is a valid export.');
      }
    };
    reader.readAsText(file);
  };

  const handleLogout = () => {
    console.log("Logging out...");
    localStorage.removeItem('zotero_auth');
    localStorage.removeItem('zotero_items');
    localStorage.removeItem('zotero_collections');
    localStorage.removeItem('zotero_session_type');
    localStorage.removeItem('zotero_live_sync');
    setAuth(null);
    setItems([]);
    setCollections([]);
    setIsLiveSync(false);
  };

  useEffect(() => {
    if (auth && !isLocalSession && hasAttemptedRestore) {
      // On mount: if items are present, do a silent check. If items are missing, do full fetch.
      // On login: items is cleared by the handler, so it triggers a full fetch.
      fetchData(items.length > 0);
    }
  }, [auth, hasAttemptedRestore]);

  const fetchData = async (silent = false) => {
    if (!auth) return;
    
    // Efficiency: check library version first if silent
    if (silent && libraryVersion !== '0' && items.length > 0) {
      try {
        const userID = auth.userID;
        const libraryType = (auth as any).libraryType === 'group' || (auth as any).libraryType === 'groups' ? 'groups' : 'users';
        const baseUrl = `https://api.zotero.org/${libraryType}/${userID}/items`;
        
        const params = new URLSearchParams({ 
          limit: '1'
        });
        if (auth.apiKey) params.append('key', auth.apiKey);
        
        const headers: any = { 'Zotero-API-Version': '3' };

        const checkRes = await fetch(`${baseUrl}?${params.toString()}`, { headers });
        const currentVersion = checkRes.headers.get('last-modified-version') || checkRes.headers.get('Last-Modified-Version');
        
        if (currentVersion && currentVersion === libraryVersion) {
          console.log('Zotero sync skipped: No changes detected (Version: ' + currentVersion + ')');
          setLastSyncTime(new Date());
          return;
        }
      } catch (e) {
        console.error('Version check failed, proceeding with full sync', e);
      }
    }

    if (!silent) {
      setIsLoading(true);
      setSyncError(null);
      setLoadStats({ current: 0, total: 100 }); // Default estimate
    }
    
    const isIncremental = silent && items.length > 0 && libraryVersion !== '0';
    
    try {
      const userID = auth.userID;
      const libraryType = (auth as any).libraryType === 'group' || (auth as any).libraryType === 'groups' ? 'groups' : 'users';
      const baseApiUrl = `https://api.zotero.org/${libraryType}/${userID}`;
      
      const headers: any = { 'Zotero-API-Version': '3' };

      // 1. Fetch Collections (Always refresh if not silent)
      if (!silent) {
        const collParams = new URLSearchParams({ limit: '100' });
        if (auth.apiKey) collParams.append('key', auth.apiKey);
        
        const collRes = await fetch(`${baseApiUrl}/collections?${collParams.toString()}`, { headers });
        if (collRes.ok) {
          const collectionsData = await collRes.json();
          const latestVersion = collRes.headers.get('last-modified-version') || collRes.headers.get('Last-Modified-Version');
          if (latestVersion) {
            setLibraryVersion(latestVersion);
          }
          if (Array.isArray(collectionsData)) {
            setCollections(collectionsData);
          }
        }
      }

      const collNameMap: Record<string, string> = {};
      collections.forEach((c: any) => {
        collNameMap[c.key] = c.data.name;
      });

      // 2. Fetch Items
      let start = 0;
      const limit = 100;
      let total = 999999; 
      let totalFetchedItems: any[] = [];
      let hasMore = true;

      if (isIncremental) {
        console.log('Starting incremental sync since version:', libraryVersion);
      }

      while (hasMore && start < total) {
        const queryParams = new URLSearchParams({
          start: start.toString(),
          limit: limit.toString(),
          format: 'json'
        });
        if (auth.apiKey) queryParams.append('key', auth.apiKey);
        if (isIncremental) queryParams.append('since', libraryVersion);
        
        const response = await fetch(`${baseApiUrl}/items?${queryParams.toString()}`, { headers });
        if (!response.ok) {
          if (response.status === 412) { // Precondition failed - library changed significantly?
            console.warn('Sync 412: Version mismatch, forcing full sync');
            return fetchData(false); 
          }
          throw new Error(`Items error: ${response.status}`);
        }
        
        const batchData = await response.json();
        const batchVersion = response.headers.get('last-modified-version') || response.headers.get('Last-Modified-Version');
        
        if (start === 0) {
          const totalHeader = response.headers.get('total-results') || response.headers.get('Total-Results');
          if (totalHeader) {
            total = Math.min(parseInt(totalHeader, 10), 10000);
            setLoadStats(prev => ({ ...prev, total }));
          }
          if (batchVersion) setLibraryVersion(batchVersion);
        }

        if (Array.isArray(batchData)) {
          if (batchData.length < limit) hasMore = false;
          if (batchData.length === 0) break;
          
          totalFetchedItems = [...totalFetchedItems, ...batchData];
          
          // Incremental processing
          const parents = batchData.filter(i => !i.data.parentItem && !['attachment', 'note'].includes(i.data.itemType));
          const children = batchData.filter(i => i.data.parentItem);

          const processed = parents.map(p => {
            const attachments = children.filter(c => c.data.parentItem === p.key && c.data.itemType === 'attachment');
            const pdf = attachments.find(a => a.data.contentType === 'application/pdf') || attachments[0];
            
            let knowledgeTotal = p.meta.numChildren || 0;
            attachments.forEach(a => {
              knowledgeTotal += (a.meta.numChildren || 0);
            });
            knowledgeTotal = Math.max(0, knowledgeTotal - attachments.length);

            return {
              key: p.key,
              data: p.data,
              meta: {
                creatorSummary: p.meta.creatorSummary || 'Unknown Creator',
                attachmentKey: pdf?.key || '',
                annotationCount: knowledgeTotal,
                collections: (p.data.collections || []).map((id: string) => collNameMap[id] || id)
              }
            };
          });

          if (isIncremental) {
            setItems(prev => {
              const newMap = new Map(prev.map(i => [i.key, i]));
              processed.forEach(newItem => {
                newMap.set(newItem.key, newItem);
              });
              return Array.from(newMap.values());
            });
          } else {
            // During full sync, we replace items batch by batch initially to show progress, 
            // but we need to accumulate them in local rawItems equivalent
            if (start === 0) {
              setItems(processed);
            } else {
              setItems(prev => [...prev, ...processed]);
            }
          }

          setLoadStats(prev => ({ 
            current: totalFetchedItems.length, 
            total: hasMore ? Math.max(total, totalFetchedItems.length + 1) : totalFetchedItems.length 
          }));
          setLastSyncTime(new Date());
        } else {
          break;
        }

        start += limit;
        if (start > 10000) break;
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
      setSyncError(error instanceof Error ? error.message : 'Sync Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directKeyData.userID || !directKeyData.apiKey) return;

    setIsLoading(true);
    setSyncError(null);
    setItems([]); // Clear existing items to avoid "inaccurate data" confusion during switch
    setDbStatus('Validating Connection...');

    const payload: AuthPayload = {
      username: `${directKeyData.libraryType === 'group' ? 'Group' : 'Cloud'} Account ${directKeyData.userID}`,
      userID: directKeyData.userID,
      apiKey: directKeyData.apiKey,
      token: 'apikey',
      secret: 'apikey',
      libraryType: directKeyData.libraryType === 'user' ? 'users' : 'groups'
    } as any;

    setAuth(payload);
    setIsLiveSync(true); // Default to live sync for cloud accounts
  };


  // Reading status helpers - reusable
  const isReading = (item: ZoteroItem) => item.data.tags?.some(t => {
    const clean = (t.tag || '').toLowerCase().replace('#', '');
    return clean === tagConfig.reading.toLowerCase();
  });
  
  const isQueued = (item: ZoteroItem) => item.data.tags?.some(t => {
    const clean = (t.tag || '').toLowerCase().replace('#', '');
    return clean === tagConfig.queue.toLowerCase();
  });

  const isRead = (item: ZoteroItem) => {
    const tags = item.data.tags || [];
    return tags.some((t: any) => {
      const clean = (t.tag || '').toLowerCase().replace('#', '');
      return clean === tagConfig.read.toLowerCase();
    });
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const counts = { total: 0, reading: 0, read: 0, queued: 0 };
    const typeCounts: Record<string, number> = {};
    const collectionExposures: Record<string, number> = {};
    const monthlyStats: Record<string, number> = {};
    const habitGroup: Record<string, number> = {};

    counts.total = items.length;

    items.forEach(item => {
      // Core counters
      if (isRead(item)) counts.read++;
      else if (isReading(item)) counts.reading++;
      else if (isQueued(item)) counts.queued++;

      // Type data
      const iType = item.data.itemType;
      typeCounts[iType] = (typeCounts[iType] || 0) + 1;

      // Collection data
      (item.meta.collections || []).forEach(c => {
        collectionExposures[c] = (collectionExposures[c] || 0) + 1;
      });

      // Monthly Stats (Added)
      const dateAdded = new Date(item.data.dateAdded);
      const month = dateAdded.toLocaleString('default', { month: 'short' });
      monthlyStats[month] = (monthlyStats[month] || 0) + 1;

      // Habit data indexing - use local date to match user's perspective
      if (item.data.dateModified) {
        const d = new Date(item.data.dateModified);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        habitGroup[localDate] = (habitGroup[localDate] || 0) + 1;
      }
    });

    const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
    const monthlyData = Object.entries(monthlyStats).map(([name, count]) => ({ name, count }));

    // Habit data: filter based on timeRange
    const now = new Date();
    const rangeLength = timeRange === 'weekly' ? 7 : timeRange === 'monthly' ? 30 : 90;
    
    const habitDays = Array.from({ length: rangeLength }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (rangeLength - 1 - i));
      
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date: localDate, count: habitGroup[localDate] || 0, display: d.getDate() };
    });

    const currentStreak = habitDays.reduceRight((acc, day) => {
      if (day.count > 0 && acc.counting) {
        return { count: acc.count + 1, counting: true };
      }
      return { ...acc, counting: false };
    }, { count: 0, counting: true }).count;

    const itemsPerWeek = Math.round((items.filter(i => {
      const addedDate = new Date(i.data.dateAdded);
      return (now.getTime() - addedDate.getTime()) < (30 * 24 * 60 * 60 * 1000);
    }).length) / 4);

    const topCollections = (Object.entries(collectionExposures) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return { ...counts, typeData, monthlyData, habitDays, currentStreak, itemsPerWeek, topCollections };
  }, [items, timeRange, tagConfig]);

  const filteredItems = items.filter(item => {
    const title = item.data.title || '';
    const creator = item.meta.creatorSummary || '';
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = title.toLowerCase().includes(query) ||
          creator.toLowerCase().includes(query);
    
    if (selectedDate) {
      const itemDate = (item.data.dateModified || '').split(/[ T]/)[0];
      return matchesSearch && itemDate === selectedDate;
    }
    
    if (activeTab === 'library') {
      if (libraryFilter === 'reading' && !isReading(item)) return false;
      if (libraryFilter === 'queue' && !isQueued(item)) return false;
      if (libraryFilter === 'read' && !isRead(item)) return false;
    }

    return matchesSearch;
  });

  const getZoteroLink = (item: ZoteroItem) => {
    const isGroup = auth?.libraryType === 'groups' || (auth as any)?.libraryType === 'group';
    const libPrefix = isGroup ? `groups/${auth?.userID}` : 'library';
    
    if (item.meta.attachmentKey) {
      const page = (item.meta.lastPage || 0) + 1;
      return `zotero://open-pdf/${libPrefix}/items/${item.meta.attachmentKey}?page=${page}`;
    }
    return `zotero://select/${libPrefix}/items/${item.key}`;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    if (!sortConfig) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch(sortConfig.key) {
        case 'title': aVal = a.data.title; bVal = b.data.title; break;
        case 'creator': aVal = a.meta.creatorSummary; bVal = b.meta.creatorSummary; break;
        case 'progress': 
          aVal = isRead(a) ? 3 : isReading(a) ? 2 : isQueued(a) ? 1 : 0;
          bVal = isRead(b) ? 3 : isReading(b) ? 2 : isQueued(b) ? 1 : 0;
          break;
        case 'notes': aVal = a.meta.annotationCount || 0; bVal = b.meta.annotationCount || 0; break;
        case 'dateModified': aVal = new Date(a.data.dateModified).getTime(); bVal = new Date(b.data.dateModified).getTime(); break;
        default: return 0;
      }

      if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [filteredItems, sortConfig]);

  const priorityItems = items
    .filter(i => isReading(i) || isQueued(i))
    .sort((a, b) => new Date(b.data.dateModified).getTime() - new Date(a.data.dateModified).getTime());

  if (!auth) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-slate-200 p-10 rounded-xl shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white text-xs font-bold">Z</div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-slate-500">Library Analytics</h1>
          </div>

          <h2 className="text-2xl font-bold mb-4 text-slate-900">Research Insight Desktop</h2>
          
          {syncError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[10px] font-bold uppercase tracking-tight flex items-center gap-2">
              <X size={14} className="bg-red-600 text-white rounded-full p-0.5" />
              <span>{syncError}</span>
            </div>
          )}

          <p className="mb-8 leading-relaxed text-slate-600 text-sm">
            {dbStatus ? (
              <span className="text-blue-500 font-bold animate-pulse">{dbStatus}</span>
            ) : (
              "Connect directly to your local Zotero database for real-time analytics. Your data never leaves your computer."
            )}
          </p>

          <div className="space-y-4">
            {!showDirectKeyForm ? (
              <>
                <label className="w-full bg-slate-800 text-white py-5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group shadow-xl shadow-blue-900/10 border border-slate-700">
                  <Database size={28} className="group-hover:scale-110 group-hover:text-blue-400 transition-all" />
                  <div className="text-center">
                    <div className="block">Open Zotero Database</div>
                    <div className="text-[9px] text-slate-400 font-medium normal-case mt-1">Select your zotero.sqlite file</div>
                  </div>
                  <input type="file" accept=".sqlite" onChange={handleSqliteUpload} className="hidden" />
                </label>

                <div className="relative pt-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                  <div className="relative flex justify-center text-[9px] uppercase font-bold text-slate-300"><span className="bg-white px-2 tracking-widest">Or Realtime Cloud Sync</span></div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => setShowDirectKeyForm(true)}
                    className="border border-slate-200 text-slate-500 py-3 rounded-lg font-bold text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <RefreshCw size={14} />
                    <span>Cloud Sync (API Key)</span>
                  </button>
                </div>
                
                <div className="text-center mt-4">
                  <label className="text-[9px] text-slate-400 cursor-pointer hover:text-slate-600 transition-all">
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                    Upload JSON Export
                  </label>
                </div>
              </>
            ) : (
              <motion.form 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleKeyLogin} 
                className="space-y-3"
              >
                <div className="space-y-1">
                   <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Library Type</label>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setDirectKeyData(prev => ({ ...prev, libraryType: 'user' }))}
                          className={`text-[8px] font-black px-2 py-0.5 rounded ${directKeyData.libraryType === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                        >
                          PERSONAL
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDirectKeyData(prev => ({ ...prev, libraryType: 'group' }))}
                          className={`text-[8px] font-black px-2 py-0.5 rounded ${directKeyData.libraryType === 'group' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                        >
                          GROUP
                        </button>
                      </div>
                   </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ID (User or Group)</label>
                   <input 
                    type="text" 
                    required
                    placeholder="e.g. 1234567" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    value={directKeyData.userID}
                    onChange={(e) => setDirectKeyData(prev => ({ ...prev, userID: e.target.value }))}
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Zotero API Key</label>
                   <input 
                    type="password" 
                    required
                    placeholder="Enter your private API key" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    value={directKeyData.apiKey}
                    onChange={(e) => setDirectKeyData(prev => ({ ...prev, apiKey: e.target.value }))}
                   />
                </div>
                <div className="flex gap-2 pt-2">
                   <button 
                    type="button"
                    onClick={() => setShowDirectKeyForm(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                   >
                     Back
                   </button>
                   <button 
                    type="submit"
                    className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                   >
                     Establish Sync
                   </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2 leading-tight">
                  You can generate a key at <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">zotero.org/settings/keys</a>
                </p>
              </motion.form>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-4">
              <span className={`w-2 h-2 rounded-full mr-2 ${isLocalSession ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`}></span>
              Status: {isLocalSession ? 'Establishing Handshake' : 'Operational'}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex overflow-hidden">
      {/* Zotero-style Sidebar - COMPACT */}
      <aside className="w-20 border-r border-slate-200 flex flex-col bg-white flex-shrink-0 z-40">
        <div className="p-4 border-b border-slate-100 flex items-center justify-center">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg shadow-slate-200">Z</div>
        </div>
 
        <nav className="flex-1 py-10 px-2 space-y-4">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={24} /> },
            { id: 'library', label: 'Library', icon: <Library size={24} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center justify-center p-3 rounded-2xl transition-all duration-300 relative group ${
                activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-110' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-all translate-x-[-10px] group-hover:translate-x-0 z-50">
                {tab.label}
              </div>
              {activeTab === tab.id && (
                <motion.div layoutId="active-dot" className="absolute -left-1 w-1.5 h-8 bg-blue-600 rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 flex flex-col items-center gap-4 bg-slate-50">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">
              {activeTab === 'overview' ? 'Pulse' : activeTab === 'library' ? 'Archive' : 'Insights'}
            </h2>
            <div className="h-6 w-px bg-slate-100 mx-2"></div>
            <div className="flex items-center gap-2">
                 {isLocalSession ? (
                   <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-lg tracking-widest uppercase shadow-sm">LOCAL</span>
                 ) : (
                   <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-lg tracking-widest uppercase shadow-sm">CLOUD</span>
                 )}
                 <span className="text-[10px] text-slate-300 font-black uppercase ml-1">{metrics.total} ITEMS</span>
                 {syncError && (
                   <div className="ml-4 flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-tight animate-pulse">
                     <X size={12} className="bg-red-500 text-white rounded-full p-0.5" />
                     <span>Sync Failed: {syncError}</span>
                   </div>
                 )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            {isLoading && (
              <div className="flex items-center gap-3">
                 <div className="text-right">
                    <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none">Syncing...</div>
                    <div className="text-[8px] font-bold text-slate-400 mt-1">{loadStats.current}/{loadStats.total}</div>
                 </div>
                 <RefreshCw size={16} className="text-blue-600 animate-spin" />
              </div>
            )}

            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl transition-all border ${showProfileMenu ? 'bg-slate-50 border-slate-200' : 'bg-white border-transparent hover:border-slate-100'}`}
              >
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-black text-slate-900 leading-none mb-1">{auth.username}</div>
                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{isLocalSession ? 'Offline' : 'Online'}</div>
                </div>
                <div className="h-10 w-10 bg-slate-900 rounded-[1rem] flex items-center justify-center text-white text-xs font-black shadow-lg shadow-slate-200 hover:bg-blue-600 transition-colors">
                  {auth.username[0].toUpperCase()}
                </div>
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 z-50 pointer-events-auto"
                    >
                       <div className="mb-6">
                          <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Connected ID</div>
                          <div className="text-xs font-black text-slate-900 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 truncate">{auth.userID}</div>
                       </div>

                       <div className="space-y-4 pt-4 border-t border-slate-50">
                          <div className="flex items-center justify-between">
                             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Sync</div>
                             <button 
                                onClick={() => { setIsLiveSync(!isLiveSync); setShowProfileMenu(false); }}
                                className={`w-10 h-5 rounded-full transition-all relative ${isLiveSync ? 'bg-emerald-500' : 'bg-slate-200'}`}
                             >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isLiveSync ? 'left-6' : 'left-1'}`}></div>
                             </button>
                          </div>

                          <button 
                             onClick={() => { setShowSettings(true); setShowProfileMenu(false); }}
                             className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                          >
                             <Settings size={12} />
                             Status Tags
                          </button>

                          {!isLocalSession && (
                            <button 
                              onClick={() => { fetchData(); setShowProfileMenu(false); }}
                              disabled={isLoading}
                              className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                            >
                              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                              Force Update
                            </button>
                          )}

                          <button 
                            onClick={() => { handleLogout(); setShowProfileMenu(false); }}
                            className="w-full py-3 border border-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                          >
                            <LogOut size={12} />
                            Log Out
                          </button>
                       </div>
                       
                       {lastSyncTime && (
                         <div className="mt-4 text-[8px] text-slate-400 text-center font-bold uppercase tracking-widest">
                           Last Sync: {lastSyncTime.toLocaleTimeString()}
                         </div>
                       )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="relative bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-slate-100"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Tag Mapping</h2>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mt-1">Define which Zotero tags trigger library status</p>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-6">
                  {(['reading', 'queue', 'read'] as const).map(type => (
                    <div key={type} className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{type === 'reading' ? 'Reading' : type === 'queue' ? 'Queue' : 'Read'} Tag</label>
                       <div className="relative">
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200 transition-all"
                            value={tagConfig[type as keyof typeof tagConfig]}
                            onChange={(e) => {
                              const newConfig = { ...tagConfig, [type]: e.target.value };
                              setTagConfig(newConfig);
                              localStorage.setItem('zotero_tag_config', JSON.stringify(newConfig));
                            }}
                            placeholder={`e.g. ${type === 'reading' ? 'reading' : type === 'queue' ? 'toread' : 'finished'}`}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                             <Tag size={14} />
                          </div>
                       </div>
                    </div>
                  ))}
                </div>

                <div className="mt-10 p-6 bg-blue-50 rounded-3xl border border-blue-100">
                   <div className="flex items-center gap-3 text-blue-600 mb-2">
                      <Zap size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Pro Tip</span>
                   </div>
                   <p className="text-[11px] text-blue-900 leading-relaxed">Changes apply instantly to your library view. Use exact tag names (no # needed).</p>
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full mt-8 py-5 bg-slate-900 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-100 hover:bg-blue-600 transition-all hover:shadow-blue-200 active:scale-95"
                >
                  Save Configuration
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="Reading Depth" value={items.reduce((acc, i) => acc + (i.meta.annotationCount || 0), 0)} subLabel="Total Annotations" />
                    <MetricCard label="Reading Rate" value={`${metrics.itemsPerWeek}/wk`} subLabel="Consumption Rate" status="up" />
                    <MetricCard label="Reading Density" value={(items.reduce((acc, i) => acc + (i.meta.annotationCount || 0), 0) / Math.max(1, metrics.total)).toFixed(1)} subLabel="Notes per Library Item" />
                    <MetricCard label="Coverage" value={`${Math.round((items.filter(i => (i.meta.collections || []).length > 0).length / Math.max(1, metrics.total)) * 100)}%`} subLabel="Organized Items" />
                 </div>

                 <div className="grid grid-cols-12 gap-6">
                    {/* Reading Progress Map */}
                    <div className="col-span-12 lg:col-span-8 bg-white p-8 border border-slate-200 rounded-3xl shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1 italic">Reading Progress Map</h3>
                          <div className="flex items-center gap-4">
                             <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                               {selectedDate ? `Selected date: ${selectedDate}` : 'History of reading progress'}
                             </p>
                             <div className="flex bg-slate-50 rounded-xl p-0.5 border border-slate-100">
                               {['7D', '30D', '90D'].map((r, i) => {
                                 const key = ['weekly', 'monthly', 'overall'][i] as any;
                                 return (
                                   <button 
                                     key={r}
                                     onClick={() => setTimeRange(key)}
                                     className={`px-3 py-1 rounded-lg text-[8px] font-black tracking-widest transition-all ${timeRange === key ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                   >
                                     {r}
                                   </button>
                                 );
                               })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Library Pulse</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                        {metrics.habitDays.map((day, i) => {
                          const intensity = day.count === 0 ? 0 : day.count >= 5 ? 3 : day.count >= 2 ? 2 : 1;
                          const colors = [
                            'bg-slate-50 text-slate-300 hover:bg-slate-100',
                            'bg-blue-200 text-blue-700 hover:bg-blue-300',
                            'bg-blue-400 text-white hover:bg-blue-500',
                            'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:scale-105'
                          ];

                          return (
                            <button 
                              key={i} 
                              onClick={() => setSelectedDate(selectedDate === day.date ? null : day.date)}
                              className={`group relative h-14 rounded-xl flex flex-col items-center justify-center transition-all ${
                                selectedDate === day.date 
                                  ? 'bg-slate-900 text-white ring-4 ring-slate-100 shadow-xl' 
                                  : colors[intensity]
                              }`}
                            >
                              <span className="text-[10px] font-black">{day.display}</span>
                              {day.count > 0 && <span className="text-[8px] font-medium opacity-70 uppercase tracking-tighter">{day.count} READS</span>}
                              
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                {day.date} • {day.count} Reading Items
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedDate ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-8 border-t border-slate-50 pt-6"
                        >
                          <div className="flex items-center justify-between mb-4">
                             <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reading Detail: {selectedDate}</div>
                             <button onClick={() => setSelectedDate(null)} className="text-[10px] font-bold text-blue-600 hover:underline">Collapse Log ×</button>
                          </div>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {filteredItems.map(item => (
                               <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                 <div className="flex items-center gap-3 truncate">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    <a 
                                      href={getZoteroLink(item)}
                                      className="text-[11px] font-bold text-slate-700 truncate hover:text-blue-600"
                                    >
                                      {item.data.title}
                                    </a>
                                 </div>
                                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter ml-4 whitespace-nowrap">
                                    Sync @ {new Date(item.data.dateModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                               </div>
                             ))}
                          </div>
                        </motion.div>
                      ) : (
                        <div className="mt-8 min-h-[250px] h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.monthlyData}>
                              <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '10px', color: '#fff' }}
                                itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                              />
                              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Reading Engagement */}
                    <div className="col-span-12 lg:col-span-4 bg-white p-8 border border-slate-200 rounded-3xl shadow-sm flex flex-col">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 italic">Reading Habits</h3>
                      <div className="space-y-8 flex-1">
                        <HealthBar label="Consistency" value={Math.round((metrics.currentStreak / 7) * 100)} color="bg-orange-500" />
                        <HealthBar label="Library Mastery" value={Math.round((metrics.read / Math.max(1, metrics.total)) * 100)} color="bg-blue-600" />
                        <HealthBar label="Library Health" value={100} color="bg-emerald-500" />
                      </div>
                      
                      <div className="mt-8 space-y-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Collection Focus</h3>
                        <div className="space-y-4">
                          {metrics.topCollections.map((col, idx) => (
                            <div key={col.name} className="relative">
                               <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9px] font-black uppercase text-slate-900 truncate pr-4">{idx + 1}. {col.name}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{col.count} Items</span>
                               </div>
                               <div className="w-full bg-slate-50 h-1.5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(col.count / Math.max(1, metrics.total)) * 100}%` }}
                                    className="h-full bg-blue-600 rounded-full"
                                  />
                               </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Highly Annotated Items - LIST VIEW */}
                    <div className="col-span-12 bg-white border border-slate-200 p-10 rounded-[3rem] shadow-sm">
                       <div className="mb-10 flex justify-between items-end">
                          <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em] mb-2 italic">Knowledge Foundation</h2>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight italic">Synthesis of your most deeply analyzed research and reference materials</p>
                          </div>
                          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl">
                             Showing top {Math.min(24, items.filter(i => (i.meta.annotationCount || 0) > 0).length)} Analyzed Items
                          </div>
                       </div>
                       
                       <div className="space-y-4">
                          {items
                            .filter(i => (i.meta.annotationCount || 0) > 0)
                            .sort((a, b) => (b.meta.annotationCount || 0) - (a.meta.annotationCount || 0))
                            .slice(0, 24)
                            .map((item, idx) => (
                              <motion.div 
                                key={item.key} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="flex items-center justify-between group p-6 hover:bg-slate-50 rounded-3xl transition-all border border-slate-100 bg-white hover:shadow-xl hover:shadow-blue-50/30"
                              >
                                 <div className="flex items-center gap-6 overflow-hidden flex-1">
                                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white flex-shrink-0 group-hover:bg-blue-600 transition-colors shadow-lg shadow-slate-100">
                                       <span className="text-[10px] font-black opacity-50 mb-0.5">#{idx + 1}</span>
                                       <BookOpen size={18} />
                                    </div>
                                    <div className="truncate flex-1">
                                       <a 
                                          href={getZoteroLink(item)}
                                          className="text-[14px] font-black text-slate-900 truncate leading-tight block hover:text-blue-600 transition-colors group-hover:italic mb-1"
                                        >
                                          {item.data.title}
                                       </a>
                                       <div className="flex items-center gap-4">
                                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.meta.creatorSummary}</div>
                                          <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                          <div className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">
                                             {(item.meta.collections || [])[0] || 'Uncategorized'}
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-8 ml-8">
                                    <div className="flex flex-col items-center">
                                       <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                       <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isRead(item) ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                          {isRead(item) ? 'Read' : 'Processing'}
                                       </div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[80px]">
                                       <div className="text-2xl font-black text-slate-900 leading-none">{item.meta.annotationCount || 0}</div>
                                       <div className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Annotations</div>
                                    </div>
                                 </div>
                              </motion.div>
                            ))
                          }
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'library' && (
              <motion.div 
                key="library"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden relative">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
                   
                   <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-slate-200">
                          <Library size={32} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Items Library</h3>
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">Browse all synced research items</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4">
                         <div className="relative w-full sm:w-auto">
                           <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                           <input 
                             type="text" 
                             placeholder="Search descriptors..." 
                             className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs w-full sm:w-64 focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold placeholder:text-slate-300 shadow-inner"
                             value={searchQuery}
                             onChange={(e) => setSearchQuery(e.target.value)}
                           />
                         </div>
                         <button className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">
                            Sync Core
                         </button>
                      </div>
                   </div>

                   <div className="relative mt-8 pt-6 border-t border-slate-50 flex flex-wrap items-center gap-4">
                      {[
                        { id: 'all', label: 'All Refs' },
                        { id: 'reading', label: 'In Progress' },
                        { id: 'queue', label: 'Queue' },
                        { id: 'read', label: 'Completed' }
                      ].map((filter) => (
                        <button 
                          key={filter.id} 
                          onClick={() => setLibraryFilter(filter.id as any)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${libraryFilter === filter.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                          {filter.label}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th 
                            onClick={() => handleSort('title')}
                            className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                             <div className="flex items-center gap-2">
                               Research Item {sortConfig?.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                             </div>
                          </th>
                          <th 
                            onClick={() => handleSort('creator')}
                            className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                             <div className="flex items-center gap-2">
                               Author {sortConfig?.key === 'creator' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                             </div>
                          </th>
                          <th 
                            onClick={() => handleSort('progress')}
                            className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                             <div className="flex items-center gap-2">
                               Status {sortConfig?.key === 'progress' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                             </div>
                          </th>
                          <th 
                            onClick={() => handleSort('notes')}
                            className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                             <div className="flex items-center gap-2">
                               Annotations {sortConfig?.key === 'notes' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                             </div>
                          </th>
                          <th 
                            onClick={() => handleSort('dateModified')}
                            className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                             <div className="flex items-center justify-end gap-2">
                               Last Modified {sortConfig?.key === 'dateModified' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                             </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedItems
                          .map((item, index) => {
                            return (
                              <motion.tr 
                                key={item.key}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.01 }}
                                className="hover:bg-slate-50 group transition-all"
                              >
                                <td className="px-8 py-5 max-w-md">
                                  <div className="flex items-center gap-4">
                                     <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white group-hover:bg-blue-600 transition-colors flex-shrink-0">
                                        <BookOpen size={14} />
                                     </div>
                                     <div className="min-w-0">
                                        <a 
                                          href={getZoteroLink(item)}
                                          className="text-[12px] font-black text-slate-900 leading-tight block hover:text-blue-600 transition-colors truncate"
                                        >
                                          {item.data.title}
                                        </a>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                           {item.meta.collections?.slice(0, 1).map(c => (
                                             <span key={c} className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">{c}</span>
                                           ))}
                                        </div>
                                     </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">{item.meta.creatorSummary}</span>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-3">
                                      {isRead(item) ? (
                                        <span className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border border-emerald-100 flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                          Finished
                                        </span>
                                      ) : isReading(item) ? (
                                        <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border border-blue-100 flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                          In Progress
                                        </span>
                                      ) : isQueued(item) ? (
                                        <span className="bg-slate-50 text-slate-400 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border border-slate-100">
                                          Queued
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Unlabeled</span>
                                      )}
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-2">
                                      <span className="text-[12px] font-black text-slate-900">{item.meta.annotationCount || 0}</span>
                                      <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                   </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest whitespace-nowrap">
                                    {new Date(item.data.dateModified).toLocaleDateString()}
                                  </span>
                                </td>
                              </motion.tr>
                            );
                          })}
                        {filteredItems.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-8 py-20 text-center">
                               <RefreshCw size={24} className="mx-auto mb-4 opacity-10 animate-spin-slow" />
                               <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 italic">No Matching Records</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, change, status, subLabel, onClick }: { label: string, value: string | number, change?: string, status?: 'up' | 'down' | 'stable', subLabel?: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div>
        <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-4">{label}</div>
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
        {change ? (
          <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${
            status === 'up' ? 'bg-emerald-50 text-emerald-600' : 
            status === 'down' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
          }`}>
            {status === 'up' ? '↑' : status === 'down' ? '↓' : '→'} {change}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{subLabel || 'Nominal'}</div>
        )}
        {onClick && <ChevronRight size={14} className="text-slate-300" />}
      </div>
    </div>
  );
}

function HealthBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-2 font-black text-slate-400 uppercase tracking-widest">
        <span>{label}</span>
        <span className="text-slate-900">{value}%</span>
      </div>
      <div className="w-full bg-slate-50 h-3 rounded-xl overflow-hidden shadow-inner border border-slate-100">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`${color} h-full rounded-xl shadow-lg transition-all duration-1000`}
        />
      </div>
    </div>
  );
}
