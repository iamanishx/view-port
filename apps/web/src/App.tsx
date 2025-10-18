/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import uploadToPresignedUrl, { createPresignedUrl } from './utils/upload';
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './App.css'

const STORAGE_KEY = "view-port";
const GROUPS_STORAGE_KEY = "view-port-groups";


function App() {
  const [initialData, setInitialData] = useState<any>(undefined);
  const saveTimeoutRef = useRef<number | null>(null);
  const [showGroupsPane, setShowGroupsPane] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null);
  const [storedGroups, setStoredGroups] = useState<Map<string, string[]>>(new Map());
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

    const groupsData = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (groupsData) {
      try {
        const parsed = JSON.parse(groupsData);
        const groupsMap = new Map<string, string[]>(Object.entries(parsed));
        setStoredGroups(groupsMap);
      } catch (e) {
        console.warn("Failed to parse stored groups:", e);
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

  const saveGroupsToStorage = useCallback((groupsMap: Map<string, string[]>) => {
    const groupsObj = Object.fromEntries(groupsMap);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groupsObj));
  }, []);

  const handleGroupButtonClick = useCallback(() => {
    if (!showGroupsPane && excalidrawAPIRef.current) {
      const elements = excalidrawAPIRef.current.getSceneElements();
      const currentGroupsMap = new Map<string, string[]>();
      
      elements.forEach((element: any) => {
        if (element.groupIds && element.groupIds.length > 0) {
          element.groupIds.forEach((groupId: string) => {
            if (!currentGroupsMap.has(groupId)) {
              currentGroupsMap.set(groupId, []);
            }
            currentGroupsMap.get(groupId)?.push(element.id);
          });
        }
      });
      
      const mergedGroups = new Map(storedGroups);
      currentGroupsMap.forEach((elementIds, groupId) => {
        mergedGroups.set(groupId, elementIds);
      });
      
      setStoredGroups(mergedGroups);
      saveGroupsToStorage(mergedGroups);
      
      const groupsList = Array.from(mergedGroups.entries()).map(([id, elementIds]) => {
        const groupElements = elements.filter((el: any) => elementIds.includes(el.id));
        return {
          id,
          elementIds,
          elements: groupElements,
          count: groupElements.length
        };
      });
      
      setGroups(groupsList);
      console.log('Found groups:', groupsList);
    }
    setShowGroupsPane(!showGroupsPane);
  }, [showGroupsPane, storedGroups, saveGroupsToStorage]);

  const handleExportGroup = useCallback(async (groupId: string) => {
    if (!excalidrawAPIRef.current) return;

    const allElements = excalidrawAPIRef.current.getSceneElements();
    const groupElementIds = storedGroups.get(groupId) || [];
    const groupElements = allElements.filter((el: any) => groupElementIds.includes(el.id));
    if (groupElements.length === 0) {
      console.warn('No elements in group', groupId);
      return;
    }

    try {
      // Use the standalone exportToBlob utility function from Excalidraw
      const appState = excalidrawAPIRef.current.getAppState();
      const files = excalidrawAPIRef.current.getFiles ? excalidrawAPIRef.current.getFiles() : null;
      
      const blob = await exportToBlob({
        elements: groupElements,
        mimeType: 'image/png',
        appState: {
          ...appState,
          exportBackground: true,
          exportWithDarkMode: false,
          viewBackgroundColor: '#ffffff'
        },
        files: files,
      });

      if (!blob) {
        console.warn('Failed to produce export blob for group', groupId);
        return;
      }

      // Upload to presigned URL
      const filename = `group-${groupId}.png`;
      const userId = 'anonymous';
      const presigned = await createPresignedUrl(filename, groupId, userId, blob.type || 'image/png');
      
      if (!presigned) {
        console.warn('Could not get presigned URL');
        return;
      }

      const uploadUrl = presigned.uploadUrl ?? presigned;
      const publicUrl = presigned.publicUrl ?? null;

      const ok = await uploadToPresignedUrl(uploadUrl, blob, blob.type || 'image/png');
      
      if (!ok) {
        console.warn('Upload failed');
        return;
      }
      
      console.log("Uploaded successfully!")
      
      if (publicUrl && typeof publicUrl === 'string') {
        const now = Date.now();
        const imgEl = {
          id: `img-${now}`,
          type: 'image',
          x: groupElements[0].x + 20,
          y: groupElements[0].y + 20,
          width: groupElements.reduce((acc:any, e:any) => acc + (e.width || 100), 0) / groupElements.length || 200,
          height: groupElements.reduce((acc:any, e:any) => acc + (e.height || 100), 0) / groupElements.length || 200,
          angle: 0,
          backgroundColor: 'transparent',
          strokeColor: '#000000',
          strokeWidth: 1,
          seed: Math.floor(Math.random()*100000),
          version: 1,
          versionNonce: Math.floor(Math.random()*1000000),
          isDeleted: false,
          link: null,
          opacity: 100,
          fileId: null,
          text: '',
          status: 'stored',
          scale: 1,
          xOffset: 0,
          yOffset: 0,
          mimeType: blob.type || 'image/png',
          src: publicUrl,
        } as any;

        const newElements = [...allElements, imgEl];
        excalidrawAPIRef.current.updateScene({ elements: newElements });
      } else {
        console.log('Uploaded group to presigned URL, no public URL returned');
      }
    } catch (e) {
      console.warn('Export/upload failed', e);
    }
  }, [storedGroups]);

  const toggleGroupExpansion = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const handleGroupClick = useCallback((groupId: string) => {
    if (!excalidrawAPIRef.current) return;
    
    const elements = excalidrawAPIRef.current.getSceneElements();
    const groupElements = elements.filter((element: any) => 
      element.groupIds && element.groupIds.includes(groupId)
    );
    
    const elementIds = groupElements.map((el: any) => el.id);
    
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

  const removeElementFromGroup = useCallback((groupId: string, elementId: string) => {
    if (!excalidrawAPIRef.current) return;

    const allElements = excalidrawAPIRef.current.getSceneElements();
    
    const elementToUpdate = allElements.find((el: any) => el.id === elementId);
    
    if (!elementToUpdate) {
      console.warn('Element not found:', elementId);
      return;
    }

    const appState = excalidrawAPIRef.current.getAppState();
    const currentSelectedIds = appState.selectedElementIds || {};

    const updatedElement = {
      ...elementToUpdate,
      groupIds: elementToUpdate.groupIds.filter((gId: string) => gId !== groupId)
    };

    const updatedElements = allElements.map((el: any) => 
      el.id === elementId ? updatedElement : el
    );

    const newSelectedIds = { ...currentSelectedIds };
    if (newSelectedIds[elementId]) {
      delete newSelectedIds[elementId];
    }

    excalidrawAPIRef.current.updateScene({
      elements: updatedElements,
      appState: {
        selectedElementIds: newSelectedIds
      }
    });

    const updatedGroups = new Map(storedGroups);
    const elementIds = updatedGroups.get(groupId) || [];
    const newElementIds = elementIds.filter(id => id !== elementId);
    updatedGroups.set(groupId, newElementIds);
    
    setStoredGroups(updatedGroups);
    saveGroupsToStorage(updatedGroups);
    
    const elements = excalidrawAPIRef.current.getSceneElements();
    const groupsList = Array.from(updatedGroups.entries()).map(([id, elementIds]) => {
      const groupElements = elements.filter((el: any) => elementIds.includes(el.id));
      return {
        id,
        elementIds,
        elements: groupElements,
        count: groupElements.length
      };
    });
    setGroups(groupsList);
    
    console.log('Removed element', elementId, 'from group', groupId);
  }, [storedGroups, saveGroupsToStorage]);

  const removeGroupAndChildren = useCallback((groupId: string) => {
    if (!excalidrawAPIRef.current) return;

    const allElements = excalidrawAPIRef.current.getSceneElements();
    const elementIds = storedGroups.get(groupId) || [];

    const updatedElements = allElements.map((el: any) => {
      if (elementIds.includes(el.id)) {
        return {
          ...el,
          groupIds: el.groupIds.filter((gId: string) => gId !== groupId)
        };
      }
      return el;
    });

    excalidrawAPIRef.current.updateScene({
      elements: updatedElements,
      appState: {
        ...excalidrawAPIRef.current.getAppState(),
        selectedElementIds: {}
      }
    });

    const updatedGroups = new Map(storedGroups);
    updatedGroups.delete(groupId);
    setStoredGroups(updatedGroups);
    saveGroupsToStorage(updatedGroups);
    setGroups(groups.filter((g) => g.id !== groupId));
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      return newSet;
    });
    console.log('Removed group', groupId, 'and its children');
  }, [storedGroups, groups, saveGroupsToStorage]);

  return (
    <div className="app-container">
      <h1>Excalidraw Example</h1>
      <div className="excalidraw-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => (excalidrawAPIRef.current = api)}
          initialData={initialData}
          onChange={(elements, state) => {
            scheduleSave({ elements, state });
            if (addToGroupId && excalidrawAPIRef.current) {
              const selectedIds = state.selectedElementIds || {};
              const selectedElementId = Object.keys(selectedIds)[0];
              if (selectedElementId) {
                const allElements = excalidrawAPIRef.current.getSceneElements();
                const elementToUpdate = allElements.find((el: any) => el.id === selectedElementId);
                if (elementToUpdate) {
                  const updatedElement = {
                    ...elementToUpdate,
                    groupIds: Array.from(new Set([...(elementToUpdate.groupIds || []), addToGroupId]))
                  };
                  const updatedElements = allElements.map((el: any) =>
                    el.id === selectedElementId ? updatedElement : el
                  );
                  excalidrawAPIRef.current.updateScene({ elements: updatedElements });
                  const updatedGroups = new Map(storedGroups);
                  const elementIds = updatedGroups.get(addToGroupId) || [];
                  if (!elementIds.includes(selectedElementId)) {
                    updatedGroups.set(addToGroupId, [...elementIds, selectedElementId]);
                  }
                  setStoredGroups(updatedGroups);
                  saveGroupsToStorage(updatedGroups);
                  const groupsList = Array.from(updatedGroups.entries()).map(([id, elementIds]) => {
                    const groupElements = updatedElements.filter((el: any) => elementIds.includes(el.id));
                    return {
                      id,
                      elementIds,
                      elements: groupElements,
                      count: groupElements.length
                    };
                  });
                  setGroups(groupsList);
                  setAddToGroupId(null);
                }
              }
            }
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
                groups.map((group) => {
                  const isExpanded = expandedGroups.has(group.id);
                  return (
                    <div
                      key={group.id}
                      style={{
                        marginBottom: '8px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        backgroundColor: '#f9f9f9',
                      }}
                    >
                      <div
                        style={{
                          padding: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          onClick={() => handleGroupClick(group.id)}
                          style={{
                            flex: 1,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                            Group {group.id.substring(0, 8)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {group.count} element{group.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupExpansion(group.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '4px 8px',
                          }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddToGroupId(group.id);
                          }}
                          style={{
                            background: addToGroupId === group.id ? '#e0e0e0' : 'none',
                            border: 'none',
                            color: '#388e3c',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px 8px',
                            marginLeft: '4px',
                          }}
                          title="Add element to group"
                        >
                          ➕
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeGroupAndChildren(group.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#d32f2f',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px 8px',
                            marginLeft: '4px',
                          }}
                          title="Remove group and its children"
                        >
                          🗑️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportGroup(group.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1976d2',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '4px 8px',
                            marginLeft: '4px',
                          }}
                          title="Export group"
                        >
                          ⬇️
                        </button>
                      </div>
                      {isExpanded && (
                        <div
                          style={{
                            borderTop: '1px solid #e0e0e0',
                            padding: '8px',
                            backgroundColor: '#fff',
                          }}
                        >
                          {group.elements.length === 0 ? (
                            <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                              Empty group
                            </div>
                          ) : (
                            group.elements.map((element: any) => (
                              <div
                                key={element.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '4px 8px',
                                  marginBottom: '4px',
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: '3px',
                                  fontSize: '12px',
                                }}
                              >
                                <span>
                                  {element.type} - {element.id.substring(0, 8)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeElementFromGroup(group.id, element.id);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#d32f2f',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    padding: '0 4px',
                                  }}
                                  title="Remove from group"
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
