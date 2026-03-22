import React from 'react';

const BrandIdentity = ({
  selectedDomain,
  isEditingIdentity,
  setIsEditingIdentity,
  editedIdentityObj,
  setEditedIdentityObj,
  handleIdentityChange,
  handleArrayIdentityChange,
  handleSaveIdentity,
}) => {
  return (
    <div className="brand-identity-section fade-in">
      <div className="identity-header">
        <h2>Brand Identity</h2>
        {!isEditingIdentity ? (
          <button className="small-btn" onClick={() => setIsEditingIdentity(true)}>
            {(selectedDomain.brand_identity && Object.keys(selectedDomain.brand_identity).length > 0) || (selectedDomain.context && (selectedDomain.context.competitors.length > 0 || selectedDomain.context.sources.length > 0)) ? 'Edit' : 'Create Identity'}
          </button>
        ) : (
          <div className="identity-actions">
            <button className="small-btn cancel" onClick={() => {
              setIsEditingIdentity(false);
              if (selectedDomain.brand_identity && Object.keys(selectedDomain.brand_identity).length > 0) {
                setEditedIdentityObj({
                  brand_name: selectedDomain.brand_identity.brand_name || '',
                  core_value_proposition: selectedDomain.brand_identity.core_value_proposition || '',
                  target_audience: selectedDomain.brand_identity.target_audience || '',
                  key_features: selectedDomain.brand_identity.key_features || [],
                  competitors: selectedDomain.brand_identity.competitors || []
                });
              } else {
                setEditedIdentityObj({
                  brand_name: '',
                  core_value_proposition: '',
                  target_audience: '',
                  key_features: [],
                  competitors: [],
                  sources: []
                });
              }
            }}>Cancel</button>
            <button className="small-btn save" onClick={handleSaveIdentity}>Save</button>
          </div>
        )}
      </div>
      {isEditingIdentity ? (
        <div className="identity-form">
          <div className="form-group">
            <label>Brand Name</label>
            <input 
              type="text" 
              value={editedIdentityObj?.brand_name || ''} 
              onChange={(e) => handleIdentityChange('brand_name', e.target.value)} 
              className="identity-input"
            />
          </div>
          <div className="form-group">
            <label>Value Proposition</label>
            <textarea 
              value={editedIdentityObj?.core_value_proposition || ''} 
              onChange={(e) => handleIdentityChange('core_value_proposition', e.target.value)}
              className="identity-input"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Target Audience</label>
            <input 
              type="text" 
              value={editedIdentityObj?.target_audience || ''} 
              onChange={(e) => handleIdentityChange('target_audience', e.target.value)}
              className="identity-input"
            />
          </div>
          <div className="form-group">
            <label>Key Features (comma separated)</label>
            <input 
              type="text" 
              value={(editedIdentityObj?.key_features || []).join(', ')} 
              onChange={(e) => handleArrayIdentityChange('key_features', e.target.value)}
              className="identity-input"
              placeholder="Feature 1, Feature 2, Feature 3"
            />
          </div>
          <div className="form-group">
            <label>Competitors (comma separated)</label>
            <input 
              type="text" 
              value={(editedIdentityObj?.competitors || []).join(', ')} 
              onChange={(e) => handleArrayIdentityChange('competitors', e.target.value)}
              className="identity-input"
              placeholder="Competitor A, Competitor B"
            />
          </div>
        </div>
      ) : ((selectedDomain.brand_identity && Object.keys(selectedDomain.brand_identity).length > 0) || (selectedDomain.context && (selectedDomain.context.competitors.length > 0 || selectedDomain.context.sources.length > 0))) ? (
        <div className="identity-viewer friendly">
          {selectedDomain.brand_identity && selectedDomain.brand_identity.brand_name && (
            <div className="identity-field">
              <strong>Brand Name:</strong>
              <p>{selectedDomain.brand_identity.brand_name}</p>
            </div>
          )}
          {selectedDomain.brand_identity && selectedDomain.brand_identity.core_value_proposition && (
            <div className="identity-field">
              <strong>Value Proposition:</strong>
              <p>{selectedDomain.brand_identity.core_value_proposition}</p>
            </div>
          )}
          {selectedDomain.brand_identity && selectedDomain.brand_identity.target_audience && (
            <div className="identity-field">
              <strong>Target Audience:</strong>
              <p>{selectedDomain.brand_identity.target_audience}</p>
            </div>
          )}
          {selectedDomain.brand_identity && selectedDomain.brand_identity.key_features && Array.isArray(selectedDomain.brand_identity.key_features) && selectedDomain.brand_identity.key_features.length > 0 && (
            <div className="identity-field">
              <strong>Key Features:</strong>
              <ul>
                {selectedDomain.brand_identity.key_features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedDomain.brand_identity && selectedDomain.brand_identity.competitors && Array.isArray(selectedDomain.brand_identity.competitors) && selectedDomain.brand_identity.competitors.length > 0 && (
            <div className="identity-field">
              <strong>Competitors:</strong>
              <div className="chips-container">
                {selectedDomain.brand_identity.competitors.map((comp, i) => (
                  <span key={i} className="chip">{comp}</span>
                ))}
              </div>
            </div>
          )}
          {selectedDomain.context && selectedDomain.context.competitors && Array.isArray(selectedDomain.context.competitors) && selectedDomain.context.competitors.length > 0 && (
            <div className="identity-field">
              <strong>Context Competitors:</strong>
              <div className="chips-container">
                {selectedDomain.context.competitors.map((comp, i) => (
                  <span key={i} className="chip">{comp}</span>
                ))}
              </div>
            </div>
          )}
          {selectedDomain.context && selectedDomain.context.sources && Array.isArray(selectedDomain.context.sources) && selectedDomain.context.sources.length > 0 && (
            <div className="identity-field">
              <strong>Context Sources:</strong>
              <ul>
                {selectedDomain.context.sources.map((source, i) => (
                  <li key={i}>
                    <a href={source} target="_blank" rel="noopener noreferrer">{source}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="identity-viewer friendly" style={{ color: '#868e96', fontStyle: 'italic' }}>
          No brand identity configured yet. Click 'Create Identity' to add one.
        </div>
      )}
    </div>
  );
};

export default BrandIdentity;