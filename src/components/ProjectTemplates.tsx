import { useState, useEffect } from 'react';
import { ProjectTemplate, CreateProjectResult } from '../types/electron';

function ProjectTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [createDatabase, setCreateDatabase] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; project: string }>({ show: false, project: '' });

  // Debug: Log state changes
  console.log('ProjectTemplates render:', { projectName, selectedTemplate, templates: templates.length });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    console.log('Projects changed:', projects);
  }, [projects]);

  const loadData = async () => {
    if (window.electronAPI) {
      console.log('Loading templates and projects...');
      const [templatesData, projectsData] = await Promise.all([
        window.electronAPI.getTemplates(),
        window.electronAPI.getProjects()
      ]);
      console.log('Templates loaded:', templatesData.length);
      console.log('Projects loaded:', projectsData);
      setTemplates(templatesData);
      setProjects(projectsData);
    }
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectName.trim()) {
      setMessage({ type: 'error', text: 'Please select a template and enter a project name' });
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    setLoading(true);
    setMessage(null);

    try {
      const result: CreateProjectResult = await window.electronAPI.createProject({
        templateId: selectedTemplate,
        projectName: projectName.trim().toLowerCase().replace(/\s+/g, '-'),
        projectPath: '',
        databaseName: template.hasDatabase ? (databaseName || projectName.trim().toLowerCase().replace(/\s+/g, '_')) : undefined,
        createDatabase: template.hasDatabase ? createDatabase : false
      });

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setProjectName('');
        setDatabaseName('');
        setSelectedTemplate(null);
        loadData();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (name: string) => {
    setDeleteConfirm({ show: true, project: name });
  };

  const confirmDelete = async () => {
    const name = deleteConfirm.project;
    setDeleteConfirm({ show: false, project: '' });

    console.log('Deleting project:', name);
    setLoading(true);
    try {
      const result = await window.electronAPI.deleteProject(name);
      console.log('Delete result:', result);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        console.log('Project deleted, reloading data...');
        await loadData();
        console.log('Data reloaded');
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error: any) {
      console.log('Delete error:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, project: '' });
  };

  const handleOpenFolder = (name: string) => {
    window.electronAPI.openProjectFolder(name);
  };

  const handleOpenBrowser = (name: string) => {
    window.electronAPI.openProjectBrowser(name);
  };

  const handleCopyUrl = async (name: string) => {
    const url = `http://localhost/${name}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ type: 'success', text: `URL copied: ${url}` });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to copy URL' });
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div>
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-xl">
                🗑️
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-on-card)' }}>Confirm Delete</h3>
            </div>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete "<strong>{deleteConfirm.project}</strong>"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30' 
            : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30'
        }`}>
          <span className="text-xl">{message.type === 'success' ? '✅' : '❌'}</span>
          <span style={{ color: 'var(--text-on-card)' }}>{message.text}</span>
        </div>
      )}

      {/* Template Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-on-card)' }}>
          📦 Select Template
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`card p-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${
                selectedTemplate === template.id
                  ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
                  : ''
              }`}
            >
              <div className="text-3xl mb-3">{template.icon}</div>
              <div className="font-bold" style={{ color: 'var(--text-on-card)' }}>{template.name}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{template.description}</div>
              <div className="flex gap-2 mt-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  template.category === 'php' ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' :
                  template.category === 'nodejs' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                  'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                }`}>
                  {template.category}
                </span>
                {template.hasDatabase && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                    DB
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Project Form */}
      {selectedTemplate && (
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-on-card)' }}>
            ✨ Create New Project
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>
                Project Name *
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => {
                  console.log('Project name input change:', e.target.value);
                  setProjectName(e.target.value);
                }}
                placeholder="my-project"
                className="input w-full"
                autoFocus
              />
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                🌐 URL: http://localhost/{projectName.toLowerCase().replace(/\s+/g, '-') || 'project-name'}
              </p>
            </div>

            {selectedTemplateData?.hasDatabase && (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <input
                    type="checkbox"
                    id="createDatabase"
                    checked={createDatabase}
                    onChange={(e) => setCreateDatabase(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <label htmlFor="createDatabase" className="text-sm font-medium" style={{ color: 'var(--text-label)' }}>
                    🗄️ Create Database
                  </label>
                </div>

                {createDatabase && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={databaseName}
                      onChange={(e) => {
                        console.log('Database name input change:', e.target.value);
                        setDatabaseName(e.target.value);
                      }}
                      placeholder={projectName.toLowerCase().replace(/\s+/g, '_') || 'database_name'}
                      className="input w-full"
                    />
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleCreateProject}
              disabled={loading || !projectName.trim()}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                loading || !projectName.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
              }`}
            >
              {loading ? '⏳ Creating...' : '🚀 Create Project'}
            </button>
          </div>
        </div>
      )}

      {/* Existing Projects */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-on-card)' }}>
          📂 Your Projects ({projects.length})
        </h3>
        
        {projects.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p style={{ color: 'var(--text-on-card)' }}>
              No projects yet. Create one using the templates above!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project}
                className="card p-4 flex items-center justify-between hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-xl shadow-lg">
                    📁
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: 'var(--text-on-card)' }}>{project}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      🌐 http://localhost/{project}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyUrl(project)}
                    className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                    title="Copy URL"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => handleOpenBrowser(project)}
                    className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                    title="Open in Browser"
                  >
                    🌐
                  </button>
                  <button
                    onClick={() => handleOpenFolder(project)}
                    className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                    title="Open Folder"
                  >
                    📂
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project)}
                    className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                    title="Delete Project"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectTemplates;
