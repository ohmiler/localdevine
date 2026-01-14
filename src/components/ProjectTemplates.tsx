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

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Project Templates</h2>

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-white">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete "{deleteConfirm.project}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Template Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Select Template</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedTemplate === template.id
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <div className="text-2xl mb-2">{template.icon}</div>
              <div className="font-semibold">{template.name}</div>
              <div className="text-xs text-gray-400 mt-1">{template.description}</div>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  template.category === 'php' ? 'bg-purple-900 text-purple-300' :
                  template.category === 'nodejs' ? 'bg-green-900 text-green-300' :
                  'bg-blue-900 text-blue-300'
                }`}>
                  {template.category}
                </span>
                {template.hasDatabase && (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-900 text-yellow-300">
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
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-3">Create New Project</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => {
                  console.log('Project name input change:', e.target.value);
                  setProjectName(e.target.value);
                }}
                placeholder="my-project"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                URL: http://localhost/{projectName.toLowerCase().replace(/\s+/g, '-') || 'project-name'}
              </p>
            </div>

            {selectedTemplateData?.hasDatabase && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="createDatabase"
                    checked={createDatabase}
                    onChange={(e) => setCreateDatabase(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="createDatabase" className="text-sm text-gray-400">
                    Create Database
                  </label>
                </div>

                {createDatabase && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Database Name</label>
                    <input
                      type="text"
                      value={databaseName}
                      onChange={(e) => {
                        console.log('Database name input change:', e.target.value);
                        setDatabaseName(e.target.value);
                      }}
                      placeholder={projectName.toLowerCase().replace(/\s+/g, '_') || 'database_name'}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleCreateProject}
              disabled={loading || !projectName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded font-semibold transition-colors"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}

      {/* Existing Projects */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Your Projects ({projects.length})</h3>
        
        {projects.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No projects yet. Create one using the templates above!
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project}
                className="flex items-center justify-between bg-gray-800 p-3 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📁</span>
                  <div>
                    <div className="font-semibold">{project}</div>
                    <div className="text-xs text-gray-400">
                      http://localhost/{project}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenBrowser(project)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    title="Open in Browser"
                  >
                    🌐
                  </button>
                  <button
                    onClick={() => handleOpenFolder(project)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    title="Open Folder"
                  >
                    📂
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
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
