import PropTypes from 'prop-types';

const Sidebar = ({
  domains,
  selectedDomain,
  newDomain,
  setNewDomain,
  onSelectDomain,
  onAddDomain,
  onDeleteDomain,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>🥄 SPOON</h2>
      </div>
      
      <div className="sidebar-section">
        <h3>Registered Domains</h3>
        <ul className="domain-list">
          {domains.map((d) => (
            <li 
              key={d.id} 
              className={`domain-item ${selectedDomain?.id === d.id ? 'active' : ''}`}
              onClick={() => onSelectDomain(d)}
            >
              <span className="domain-name">{d.name}</span>
              <button 
                className="delete-domain-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDomain(d.name);
                }}
                title="Delete domain"
              >
                ×
              </button>
            </li>
          ))}
          {domains.length === 0 && (
            <li className="empty-text">No domains registered</li>
          )}
        </ul>
      </div>

      <div className="sidebar-section add-domain-section">
        <h3>Add New Domain</h3>
        <form onSubmit={onAddDomain} className="add-domain-form">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g., example.com"
            className="small-input"
          />
          <button type="submit" className="small-btn" disabled={!newDomain}>
            Add
          </button>
        </form>
      </div>
    </aside>
  );
};

Sidebar.propTypes = {
  domains: PropTypes.array.isRequired,
  selectedDomain: PropTypes.object,
  newDomain: PropTypes.string.isRequired,
  setNewDomain: PropTypes.func.isRequired,
  onSelectDomain: PropTypes.func.isRequired,
  onAddDomain: PropTypes.func.isRequired,
  onDeleteDomain: PropTypes.func.isRequired,
};

export default Sidebar;