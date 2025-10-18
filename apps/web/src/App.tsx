import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './App.css'

const STORAGE_KEY = "view-port";

function App() {
  const [initialData, setInitialData] = useState<any>(undefined);
  const saveTimeoutRef = useRef<number | null>(null);
  const [showGroupsPane, setShowGroupsPane] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const excalidrawAPIRef = useRef<any>(null);

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      try {
        const data = JSON.parse(s);
        setInitialData(data);
      } catch (e) {
        console.warn("Failed to parse saved Excalidraw scene:", e);
      }
    }
  }, []);

  const scheduleSave = useCallback((scene: unknown) => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
      } catch (e) {
        console.warn("Failed to save Excalidraw scene:", e);
      }
      saveTimeoutRef.current = null;
    }, 1000) as unknown as number;
  }, []);

  const handleGroupButtonClick = useCallback(() => {
    if (!showGroupsPane && excalidrawAPIRef.current) {
      // Refresh groups when opening the pane
      const elements = excalidrawAPIRef.current.getSceneElements();
      const groupsMap = new Map<string, any[]>();
      
      elements.forEach((element: any) => {
        if (element.groupIds && element.groupIds.length > 0) {
          element.groupIds.forEach((groupId: string) => {
            if (!groupsMap.has(groupId)) {
              groupsMap.set(groupId, []);
            }
            groupsMap.get(groupId)?.push(element);
          });
        }
      });
      
      const groupsList = Array.from(groupsMap.entries()).map(([id, elements]) => ({
        id,
        elements,
        count: elements.length
      }));
      
      setGroups(groupsList);
      console.log('Found groups:', groupsList); // Debug log
    }
    setShowGroupsPane(!showGroupsPane);
  }, [showGroupsPane]);

  const handleServeButtonClick = useCallback(() => {
    // Does nothing for now
  }, []);

  const handleGroupClick = useCallback((groupId: string) => {
    if (!excalidrawAPIRef.current) return;
    
    const elements = excalidrawAPIRef.current.getSceneElements();
    const groupElements = elements.filter((element: any) => 
      element.groupIds && element.groupIds.includes(groupId)
    );
    
    // Get the IDs of elements in this group
    const elementIds = groupElements.map((el: any) => el.id);
    
    // Update the app state to select these elements
    excalidrawAPIRef.current.updateScene({
      appState: {
        selectedElementIds: elementIds.reduce((acc: any, id: string) => {
          acc[id] = true;
          return acc;
        }, {})
      }
    });
    
    console.log('Selected group:', groupId, 'with elements:', elementIds);
  }, []);

  return (
    <div className="app-container">
      <h1>Excalidraw Example</h1>
      <div className="excalidraw-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => (excalidrawAPIRef.current = api)}
          initialData={initialData}
          onChange={(elements, state) => {
            scheduleSave({ elements, state });
          }}
          renderTopRightUI={() => (
            <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
              <button
                onClick={handleGroupButtonClick}
                style={{
                  padding: '8px 16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: showGroupsPane ? '#e0e0e0' : '#fff',
                }}
                title="Show Groups"
              >
                G
              </button>
              <button
                onClick={handleServeButtonClick}
                style={{
                  padding: '8px 16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                }}
                title="Serve"
              >
                S
              </button>
            </div>
          )}
        />
        {showGroupsPane && (
          <div
            style={{
              position: 'absolute',
              top: '60px',
              right: '20px',
              width: '300px',
              maxHeight: '500px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              overflowY: 'auto',
              zIndex: 1000,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Groups</h3>
              <button
                onClick={() => setShowGroupsPane(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>
            <div>
              {groups.length === 0 ? (
                <p style={{ color: '#666' }}>No groups found</p>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleGroupClick(group.id)}
                    style={{
                      padding: '8px',
                      marginBottom: '8px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      backgroundColor: '#f9f9f9',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8e8e8')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f9f9f9')}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                      Group {group.id.substring(0, 8)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {group.count} element{group.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
