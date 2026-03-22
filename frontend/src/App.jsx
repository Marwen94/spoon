import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import BrandIdentity from './BrandIdentity';
import AnalysisForm from './AnalysisForm';
import ExposureReport from './ExposureReport';
import { API_BASE_URL } from './config';
import './App.css';

function App() {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  
  const [promptsCount, setPromptsCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'graph'
  const [mentionFilter, setMentionFilter] = useState('all'); // 'all', 'mentioned', 'missed'
  const [editedIdentityObj, setEditedIdentityObj] = useState({
    brand_name: '',
    core_value_proposition: '',
    target_audience: '',
    key_features: [],
    competitors: []
  });

  const handleAddSourceToContext = async (url) => {
    if (!selectedDomain) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/domains/${selectedDomain.name}/context/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error('Failed to add source to context');
      
      // Update local state to append to context
      if (selectedDomain) {
        const newContext = { ...(selectedDomain.context || { sources: [], competitors: [] }) };
        if (!newContext.sources.includes(url)) newContext.sources.push(url);
        
        const updatedDomain = { ...selectedDomain, context: newContext };
        setSelectedDomain(updatedDomain);
        localStorage.setItem('selectedDomain', JSON.stringify(updatedDomain));
      }
      alert('Source added to context successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to add source to context.');
    }
  };

  const handleAddCompetitorToContext = async (name) => {
    if (!selectedDomain) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/domains/${selectedDomain.name}/context/competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to add competitor to context');
      
      // Update local state to append to context
      if (selectedDomain) {
        const newContext = { ...(selectedDomain.context || { sources: [], competitors: [] }) };
        if (!newContext.competitors.includes(name)) newContext.competitors.push(name);
        
        const updatedDomain = { ...selectedDomain, context: newContext };
        setSelectedDomain(updatedDomain);
        localStorage.setItem('selectedDomain', JSON.stringify(updatedDomain));
      }
      alert('Competitor added to context successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to add competitor to context.');
    }
  };

  // Load domains on mount
  useEffect(() => {
    const loadData = async () => {
      await fetchDomains();
      const savedDomain = localStorage.getItem('selectedDomain');
      if (savedDomain) {
        const parsed = JSON.parse(savedDomain);
        setSelectedDomain(parsed);
        // We can fetch history for the saved domain directly
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/domains/${parsed.name}/reports`);
          if (response.ok) {
            const data = await response.json();
            const reports = data.reports || [];
            setHistory(reports);
            if (reports.length > 0) {
              aggregateReports(reports, parsed.name);
            }
          }
        } catch (err) {
          console.error("Failed to fetch history:", err);
        }
      }
    };
    loadData();
  }, []);

  const fetchDomains = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/domains`);
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      } else {
        console.error("Failed to fetch domains, status:", response.status);
      }
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.detail?.[0]?.msg || err.detail || "Failed to add domain");
        return;
      }

      const added = await response.json();
      setDomains([added, ...domains.filter(d => d.id !== added.id)]);
      handleSelectDomain(added);
      setNewDomain('');
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server");
    }
  };

  const handleSelectDomain = (domain) => {
    setSelectedDomain(domain);
    localStorage.setItem('selectedDomain', JSON.stringify(domain));
    setReport(null); // Clear previous report when switching domains
    setError(null);
    setIsEditingIdentity(false);
    if (domain.brand_identity) {
      setEditedIdentityObj({
        brand_name: domain.brand_identity.brand_name || '',
        core_value_proposition: domain.brand_identity.core_value_proposition || '',
        target_audience: domain.brand_identity.target_audience || '',
        key_features: domain.brand_identity.key_features || [],
        competitors: domain.brand_identity.competitors || []
      });
    } else {
      setEditedIdentityObj({
        brand_name: '',
        core_value_proposition: '',
        target_audience: '',
        key_features: [],
        competitors: []
      });
    }
    
    // We can fetch history for the saved domain directly
    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/domains/${domain.name}/reports`);
        if (response.ok) {
          const data = await response.json();
          const reports = data.reports || [];
          setHistory(reports);
          if (reports.length > 0) {
            aggregateReports(reports, domain.name);
          } else {
            setReport(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    };
    loadHistory();
  };

  const aggregateReports = (reportsList, domainName) => {
    let totalPrompts = 0;
    let brandMentionedCount = 0;
    let brandNotMentionedCount = 0;
    const appearedExamples = [];
    const notAppearedExamples = [];
    
    // Deduplicate prompts to avoid showing the exact same prompt multiple times
    const seenPrompts = new Set();

    reportsList.forEach(r => {
      totalPrompts += r.total_prompts;
      brandMentionedCount += r.brand_mentioned_count;
      brandNotMentionedCount += r.brand_not_mentioned_count;
      
      if (r.appeared_examples) {
        r.appeared_examples.forEach(ex => {
          if (!seenPrompts.has(ex.prompt)) {
            appearedExamples.push(ex);
            seenPrompts.add(ex.prompt);
          }
        });
      }
      
      if (r.not_appeared_examples) {
        r.not_appeared_examples.forEach(ex => {
          if (!seenPrompts.has(ex.prompt)) {
            notAppearedExamples.push(ex);
            seenPrompts.add(ex.prompt);
          }
        });
      }
    });

    const exposureRate = totalPrompts > 0 ? ((brandMentionedCount / totalPrompts) * 100).toFixed(1) : 0;

    setReport({
      domain: domainName,
      exposure_rate: exposureRate,
      total_prompts: totalPrompts,
      brand_mentioned_count: brandMentionedCount,
      brand_not_mentioned_count: brandNotMentionedCount,
      summary: `Aggregated analysis from ${reportsList.length} total runs. The brand appeared in ${brandMentionedCount} out of ${totalPrompts} total prompts across all history.`,
      appeared_examples: appearedExamples,
      not_appeared_examples: notAppearedExamples,
      generated_at: new Date().toISOString(),
      is_aggregated: true
    });
  };

  const handleBackToHistory = () => {
    setReport(null);
  };

  const handleDeleteDomain = async (domainName) => {
    if (!window.confirm(`Are you sure you want to delete ${domainName} and all its history?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/domains/${domainName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDomains(domains.filter(d => d.name !== domainName));
        if (selectedDomain && selectedDomain.name === domainName) {
          setSelectedDomain(null);
          localStorage.removeItem('selectedDomain');
          setReport(null);
          setHistory([]);
        }
      } else {
        const err = await response.json();
        alert(err.detail || "Failed to delete domain");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server");
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!selectedDomain) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          domain: selectedDomain.name, 
          prompts_count: parseInt(promptsCount) 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.[0]?.msg || errorData.detail || 'Something went wrong');
      }

      const data = await response.json();
      setReport(data);
      
      // Fetch domain history locally
      try {
        const histResponse = await fetch(`${API_BASE_URL}/api/v1/domains/${selectedDomain.name}/reports`);
        if (histResponse.ok) {
          const histData = await histResponse.json();
          const reports = histData.reports || [];
          setHistory(reports);
          if (reports.length > 0) {
            aggregateReports(reports, selectedDomain.name);
          } else {
            setReport(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
      
      // Also refresh domains to get potentially updated brand identity
      fetchDomains();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!selectedDomain) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/domains/${selectedDomain.name}/brand-identity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_identity: editedIdentityObj })
      });

      if (response.ok) {
        const updatedDomain = { ...selectedDomain, brand_identity: editedIdentityObj };
        setSelectedDomain(updatedDomain);
        localStorage.setItem('selectedDomain', JSON.stringify(updatedDomain));
        setIsEditingIdentity(false);
        fetchDomains(); // refresh the list
      } else {
        alert("Failed to save brand identity");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving brand identity");
    }
  };

  const handleIdentityChange = (field, value) => {
    setEditedIdentityObj(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayIdentityChange = (field, value) => {
    // split by comma and clean up whitespace
    const arr = value.split(',').map(i => i.trim()).filter(i => i);
    setEditedIdentityObj(prev => ({
      ...prev,
      [field]: arr
    }));
  };

  // Filter report data based on mentionFilter
  const filteredReport = report ? {
    ...report,
    appeared_examples: (mentionFilter === 'all' || mentionFilter === 'mentioned') ? report.appeared_examples : [],
    not_appeared_examples: (mentionFilter === 'all' || mentionFilter === 'missed') ? report.not_appeared_examples : [],
  } : null;

  const renderContextMarkdown = () => {
    if (!selectedDomain || !selectedDomain.context) return null;
    const { competitors, sources } = selectedDomain.context;
    
    if ((!competitors || competitors.length === 0) && (!sources || sources.length === 0)) return null;

    let md = `### Domain Analysis Context\n\n`;
    
    if (competitors && competitors.length > 0) {
      md += `**I identified these products as my key competitors:**\n`;
      competitors.forEach(comp => {
        md += `- ${comp}\n`;
      });
      md += `\n`;
    }

    if (sources && sources.length > 0) {
      md += `**I identified these sources as missed opportunities and I want to focus my analysis on them:**\n`;
      sources.forEach(src => {
        try {
          md += `- [${new URL(src).hostname}](${src})\n`;
        } catch {
          md += `- ${src}\n`;
        }
      });
    }

    return (
      <div className="context-markdown fade-in">
        <div className="markdown-block">
          <pre><code>{md}</code></pre>
          <button 
            className="small-btn copy-btn"
            onClick={() => {
              navigator.clipboard.writeText(md);
              alert('Markdown copied to clipboard!');
            }}
          >
            Copy Markdown
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar 
        domains={domains}
        selectedDomain={selectedDomain}
        newDomain={newDomain}
        setNewDomain={setNewDomain}
        onSelectDomain={handleSelectDomain}
        onAddDomain={handleAddDomain}
        onDeleteDomain={handleDeleteDomain}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {!selectedDomain ? (
          <div className="welcome-state">
            <h1>Welcome to SPOON</h1>
            <p>Select a domain from the sidebar or register a new one to start analyzing brand exposure on Perplexity AI.</p>
          </div>
        ) : (
          <div className="analysis-view">
            <header className="content-header">
              <h1>Analyzing: <strong>{selectedDomain.name}</strong></h1>
            </header>

            {(
              <BrandIdentity 
                selectedDomain={selectedDomain}
                isEditingIdentity={isEditingIdentity}
                setIsEditingIdentity={setIsEditingIdentity}
                editedIdentityObj={editedIdentityObj}
                setEditedIdentityObj={setEditedIdentityObj}
                handleIdentityChange={handleIdentityChange}
                handleArrayIdentityChange={handleArrayIdentityChange}
                handleSaveIdentity={handleSaveIdentity}
              />
            )}

            <AnalysisForm 
              promptsCount={promptsCount}
              setPromptsCount={setPromptsCount}
              loading={loading}
              handleAnalyze={handleAnalyze}
            />

            {renderContextMarkdown()}

            {error && <div className="error">{error}</div>}

            <ExposureReport 
              report={report}
              filteredReport={filteredReport}
              viewMode={viewMode}
              setViewMode={setViewMode}
              mentionFilter={mentionFilter}
              setMentionFilter={setMentionFilter}
              history={history}
              handleBackToHistory={handleBackToHistory}
              handleAddSourceToContext={handleAddSourceToContext}
              handleAddCompetitorToContext={handleAddCompetitorToContext}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;