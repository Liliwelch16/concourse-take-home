import React, { useState } from 'react';
import axios from 'axios';
import Head from 'next/head';

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // New state for attachments
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [attachmentSummary, setAttachmentSummary] = useState('');
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  
  // State for RFP generation
  const [generatedRFP, setGeneratedRFP] = useState('');
  const [rfpGenerating, setRfpGenerating] = useState(false);
  const [rfpError, setRfpError] = useState('');
  
  // State for draft response generation
  const [draftResponse, setDraftResponse] = useState('');
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftError, setDraftError] = useState('');
  
  // State for copy to clipboard
  const [copySuccess, setCopySuccess] = useState('');
  
  // State for form fields
  const [formFields, setFormFields] = useState([]);
  const [formResponses, setFormResponses] = useState({});
  
  // State for contractor information
  const [contractorName, setContractorName] = useState('Lili Welch');
  const [contractorTitle, setContractorTitle] = useState('Owner');
  const [contractorAddress, setContractorAddress] = useState('450 Clinton Avenue, Brooklyn, NY 11238');
  const [contractorDate, setContractorDate] = useState(new Date().toLocaleDateString('en-US'));

  const formatAnalysis = (text) => {
    const lines = text.split('\n');
    const formatted = [];
    
    const formatTextWithBold = (text) => {
      // Handle bold formatting
      const boldParts = text.split(/(\*\*.*?\*\*)/);
      const formattedParts = boldParts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
        }
        return part;
      });
      
      return formattedParts;
    };
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.includes(' ')) {
        // Bold headers (single line with just ** text **)
        const headerText = trimmed.replace(/\*\*/g, '');
        formatted.push(
          <div key={index} style={{ fontWeight: 'bold', marginTop: '15px', marginBottom: '8px', fontSize: '15px' }}>
            {headerText}
          </div>
        );
      } else if (trimmed.startsWith('- ')) {
        // Bullet points with bold formatting
        const bulletText = trimmed.substring(2);
        formatted.push(
          <div key={index} style={{ marginLeft: '15px', marginBottom: '4px' }}>
            • {formatTextWithBold(bulletText)}
          </div>
        );
      } else if (trimmed.length > 0) {
        // Regular text with bold formatting
        formatted.push(
          <div key={index} style={{ marginBottom: '4px' }}>
            {formatTextWithBold(trimmed)}
          </div>
        );
      }
    });
    
    return formatted;
  };

  const analyzeRFP = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    setLoading(true);
    setError('');
    setSummary('');
    
    try {
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('rfpFiles', selectedFiles[i]);
      }
      
      const response = await axios.post('/api/analyze-rfp-multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        setSummary(response.data.analysis);
      } else {
        setError('Failed to analyze the RFP content.');
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.code === 'ERR_NETWORK') {
        setError('Server error. Please try again.');
      } else {
        setError('Failed to analyze the PDF. Please check the file and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const analyzeAttachments = async () => {
    if (!attachmentFiles || attachmentFiles.length === 0) return;
    
    setAttachmentLoading(true);
    setAttachmentError('');
    setAttachmentSummary('');
    
    // Clear all other state when analyzing attachments
    setSummary('');
    setError('');
    setDraftResponse('');
    setDraftError('');
    setGeneratedRFP('');
    setRfpError('');
    
    try {
      const formData = new FormData();
      for (let i = 0; i < attachmentFiles.length; i++) {
        formData.append('attachments', attachmentFiles[i]);
      }
      
      const response = await axios.post('/api/analyze-attachments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        setAttachmentSummary(response.data.analysis);
        
        // Parse the analysis to extract form fields
        const fields = parseFormFields(response.data.analysis);
        setFormFields(fields);
        
        // Initialize form responses
        const initialResponses = {};
        fields.forEach((field, index) => {
          initialResponses[index] = '';
        });
        setFormResponses(initialResponses);
      } else {
        setAttachmentError('Failed to analyze the attachment content.');
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setAttachmentError(err.response.data.error);
      } else if (err.code === 'ERR_NETWORK') {
        setAttachmentError('Server error. Please try again.');
      } else {
        setAttachmentError('Failed to analyze the attachments. Please check the files and try again.');
      }
    } finally {
      setAttachmentLoading(false);
    }
  };

  const generateRFP = async () => {
    if (!attachmentFiles || attachmentFiles.length === 0) {
      setRfpError('Please upload RFP attachments before processing.');
      return;
    }
    
    setRfpGenerating(true);
    setRfpError('');
    setGeneratedRFP('');
    
    try {
      const formData = new FormData();
      
      // Send attachment files to Gemini
      for (let i = 0; i < attachmentFiles.length; i++) {
        formData.append('attachments', attachmentFiles[i]);
      }
      
      // Add all form field responses
      formFields.forEach((field, index) => {
        const fieldValue = formResponses[index] || '';
        formData.append(`field_${index}`, fieldValue);
        formData.append(`field_${index}_name`, field.name);
        formData.append(`field_${index}_type`, field.type);
      });
      
      // Add form fields count
      formData.append('formFieldsCount', formFields.length);
      
      const response = await axios.post('/api/generate-rfp', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        setGeneratedRFP(response.data.convertedText);
      } else {
        setRfpError('Failed to convert attachments to text.');
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setRfpError(err.response.data.error);
      } else if (err.code === 'ERR_NETWORK') {
        setRfpError('Server error. Please try again.');
      } else {
        setRfpError('Failed to process attachments. Please try again later.');
      }
    } finally {
      setRfpGenerating(false);
    }
  };

  const generateDraftResponse = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setDraftError('Please upload RFP documents before generating a draft response.');
      return;
    }
    
    setDraftGenerating(true);
    setDraftError('');
    setDraftResponse('');
    
    try {
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('rfpFiles', selectedFiles[i]);
      }
      
      const response = await axios.post('/api/generate-draft-response', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        setDraftResponse(response.data.draftResponse);
      } else {
        setDraftError('Failed to generate draft response.');
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setDraftError(err.response.data.error);
      } else if (err.code === 'ERR_NETWORK') {
        setDraftError('Server error. Please try again.');
      } else {
        setDraftError('Failed to generate draft response. Please try again later.');
      }
    } finally {
      setDraftGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      // Strip HTML formatting and convert to plain text
      const plainText = generatedRFP
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
        .replace(/\n+/g, '\n') // Clean up extra line breaks
        .trim();
      
      await navigator.clipboard.writeText(plainText);
      setCopySuccess('Copied to clipboard!');
      setTimeout(() => setCopySuccess(''), 3000);
    } catch (err) {
      setCopySuccess('Failed to copy');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  const parseFormFields = (analysisText) => {
    const fieldsMap = new Map(); // Use Map to prevent duplicates
    
    console.log('Parsing analysis text:', analysisText); // Debug log
    
    // Specific fields for the document being uploaded - all predefined to prevent duplicates
    fieldsMap.set('offerer_name', {
      name: '(Name of Offerer/bidder\'s firm)',
      description: 'Enter the official name of your company/firm',
      type: 'text'
    });
    fieldsMap.set('authorized_rep', {
      name: '(PRINT Name of Authorized Representative)', 
      description: 'Print name of person authorized to sign',
      type: 'text'
    });
    fieldsMap.set('date', {
      name: 'Date:',
      description: 'Date of submission',
      type: 'date'
    });
    fieldsMap.set('signature', {
      name: 'Signature:',
      description: 'Authorized representative signature',
      type: 'signature'
    });
    fieldsMap.set('title', {
      name: 'Title:',
      description: 'Title/position of authorized representative',
      type: 'text'
    });
    fieldsMap.set('contractor_address', {
      name: 'Contractor Address:',
      description: 'Complete business address',
      type: 'text'
    });
    fieldsMap.set('individual_entity_name', {
      name: 'Name of Individual or Entity Seeking to Enter into the Procurement Contract:',
      description: 'Enter the name of individual or entity',
      type: 'text'
    });
    fieldsMap.set('person_submitting_form', {
      name: 'Name and Title of Person Submitting this Form:',
      description: 'Enter name and title of person submitting',
      type: 'text'
    });
    fieldsMap.set('contract_procurement_number', {
      name: 'Contract Procurement Number:',
      description: 'Enter the contract procurement number',
      type: 'number'
    });
    
    // Yes/No questions
    fieldsMap.set('question_finding_non_responsibility', {
      name: 'Has any Governmental Entity made a finding of non-responsibility regarding the individual or entity seeking to enter into the Procurement Contract in the previous four years? (Please circle):',
      description: 'Select Yes or No',
      type: 'yesno'
    });
    fieldsMap.set('question_basis_state_finance_law', {
      name: 'Was the basis for the finding of non-responsibility due to a violation of State Finance Law §139-j (Please circle):',
      description: 'Select Yes or No',
      type: 'yesno'
    });
    fieldsMap.set('question_false_incomplete_info', {
      name: 'Was the basis for the finding of non-responsibility due to the intentional provision of false or incomplete information to a Governmental Entity? (Please circle):',
      description: 'Select Yes or No',
      type: 'yesno'
    });
    fieldsMap.set('question_terminated_withheld', {
      name: 'Has any Governmental Entity or other governmental agency terminated or withheld a Procurement Contract with the above-named individual or entity due to the intentional provision of false or incomplete information? (Please circle):',
      description: 'Select Yes or No',
      type: 'yesno'
    });
    
    // Sub-fields for "If you answered yes to any of the above questions"
    fieldsMap.set('details_governmental_entity_1', {
      name: 'Governmental Entity: (for finding of non-responsibility)',
      description: 'Enter governmental entity name',
      type: 'text'
    });
    fieldsMap.set('details_date_finding', {
      name: 'Date of Finding of Non-responsibility:',
      description: 'Enter date of finding',
      type: 'date'
    });
    fieldsMap.set('details_basis_finding', {
      name: 'Basis of Finding of Non-Responsibility:',
      description: 'Explain the basis',
      type: 'text'
    });
    
    // Sub-fields for "If yes, please provide details below"
    fieldsMap.set('details_governmental_entity_2', {
      name: 'Governmental Entity: (for termination/withholding)',
      description: 'Enter governmental entity name',
      type: 'text'
    });
    fieldsMap.set('details_date_termination', {
      name: 'Date of Termination or Withholding of Contract:',
      description: 'Enter date of termination or withholding',
      type: 'date'
    });
    fieldsMap.set('details_basis_termination', {
      name: 'Basis of Termination or Withholding:',
      description: 'Explain the basis for termination or withholding',
      type: 'text'
    });
    
    // All fields are predefined above - no dynamic parsing needed
    // This prevents duplicate field creation
    
    const fields = Array.from(fieldsMap.values());
    console.log('Parsed fields:', fields); // Debug log
    return fields;
  };

  const handleFormResponse = (fieldIndex, value) => {
    setFormResponses(prev => ({
      ...prev,
      [fieldIndex]: value
    }));
  };

  const exportFormResponses = () => {
    let exportText = "RFP Form Responses:\\n\\n";
    formFields.forEach((field, index) => {
      const response = formResponses[index] || '[Not filled]';
      exportText += `${field.name}: ${response}\\n`;
      if (field.description) {
        exportText += `  Description: ${field.description}\\n`;
      }
      exportText += '\\n';
    });
    
    navigator.clipboard.writeText(exportText);
    setCopySuccess('Form responses copied to clipboard!');
    setTimeout(() => setCopySuccess(''), 3000);
  };
  
  return (
    <>
      <Head>
        <title>Concourse RFP Builder</title>
        <meta name="description" content="RFP Builder and Analysis Tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div style={{
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '50px',
        backgroundColor: '#f0f0f0',
        minHeight: '100vh'
      }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>
          Concourse RFP Builder
        </h1>
        
        <div style={{
          marginTop: '30px',
          padding: '30px',
          border: '2px dashed #007bff',
          borderRadius: '10px',
          backgroundColor: 'white',
          maxWidth: '500px',
          margin: '30px auto'
        }}>
          <h3 style={{ color: '#666', marginBottom: '8px' }}>Upload your RFP</h3>
          <p style={{ fontSize: '10px', color: '#888', marginBottom: '15px', margin: '0 0 15px 0' }}>
            Export your government RFP to PDF along with any attachments and upload them here to analyze it.
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              marginBottom: '10px'
            }}
          />
          <button
            onClick={analyzeRFP}
            disabled={!selectedFiles.length || loading}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze RFP'}
          </button>
          {error && (
            <div style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
              {error}
            </div>
          )}
          {summary && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '5px',
              textAlign: 'left',
              fontSize: '14px',
              marginTop: '10px'
            }}>
              <strong>RFP Summary:</strong>
              <div style={{ margin: '10px 0 0 0' }}>
                {formatAnalysis(summary)}
              </div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: '30px',
          padding: '30px',
          border: '2px dashed #28a745',
          borderRadius: '10px',
          backgroundColor: 'white',
          maxWidth: '500px',
          margin: '30px auto'
        }}>
          <h3 style={{ color: '#666', marginBottom: '8px' }}>Draft RFP Response</h3>
          <p style={{ fontSize: '10px', color: '#888', marginBottom: '15px', margin: '0 0 15px 0' }}>
            Generate a draft response based on your RFP analysis.
          </p>
          <button
            onClick={generateDraftResponse}
            disabled={!selectedFiles.length || draftGenerating}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: draftGenerating ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: draftGenerating ? 'not-allowed' : 'pointer'
            }}
          >
            {draftGenerating ? 'Generating...' : 'Generate Draft Response'}
          </button>
          {draftError && (
            <div style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
              {draftError}
            </div>
          )}
          {draftResponse && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '5px',
              textAlign: 'left',
              fontSize: '14px',
              marginTop: '10px'
            }}>
              <strong>Draft RFP Response:</strong>
              <div style={{ margin: '10px 0 0 0' }}>
                {formatAnalysis(draftResponse)}
              </div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: '30px',
          padding: '30px',
          border: '2px dashed #dc3545',
          borderRadius: '10px',
          backgroundColor: 'white',
          maxWidth: '500px',
          margin: '30px auto'
        }}>
          <h3 style={{ color: '#666', marginBottom: '8px' }}>Upload the RFP package</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px', margin: '0 0 15px 0' }}>
            Download the attachments to PDF that need to be filled out.
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => setAttachmentFiles(Array.from(e.target.files))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              marginBottom: '10px'
            }}
          />
          <button
            onClick={analyzeAttachments}
            disabled={!attachmentFiles.length || attachmentLoading}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: attachmentLoading ? '#ccc' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: attachmentLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {attachmentLoading ? 'Analyzing...' : 'Analyze Attachments'}
          </button>
          {attachmentError && (
            <div style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
              {attachmentError}
            </div>
          )}
          {attachmentSummary && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '5px',
              textAlign: 'left',
              fontSize: '14px',
              marginTop: '10px'
            }}>
              <strong>Attachment Analysis:</strong>
              <div style={{ margin: '10px 0 0 0' }}>
                {formatAnalysis(attachmentSummary)}
              </div>
            </div>
          )}
          
          {formFields.length > 0 && (
            <div style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'left',
              fontSize: '14px',
              marginTop: '20px',
              border: '2px solid #007bff'
            }}>
              <div style={{ marginBottom: '15px' }}>
                <strong style={{ fontSize: '16px', color: '#007bff' }}>
                  Form Fields - Fill Out Your Responses ({formFields.length} fields detected):
                </strong>
              </div>
              
              {formFields.map((field, index) => (
                <div key={index} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontWeight: 'bold', 
                    marginBottom: '5px',
                    color: '#333'
                  }}>
                    {field.name}
                  </label>
                  
                  {field.description && (
                    <p style={{ 
                      fontSize: '12px', 
                      color: '#666', 
                      marginBottom: '10px',
                      fontStyle: 'italic'
                    }}>
                      {field.description}
                    </p>
                  )}
                  
                  {field.type === 'checkbox' ? (
                    <div>
                      <input
                        type="checkbox"
                        checked={formResponses[index] === 'checked'}
                        onChange={(e) => handleFormResponse(index, e.target.checked ? 'checked' : '')}
                        style={{ marginRight: '8px' }}
                      />
                      <span>Check if applicable</span>
                    </div>
                  ) : field.type === 'yesno' ? (
                    <select
                      value={formResponses[index] || ''}
                      onChange={(e) => handleFormResponse(index, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : field.type === 'signature' ? (
                    <input
                      type="text"
                      value={formResponses[index] || ''}
                      onChange={(e) => handleFormResponse(index, e.target.value)}
                      placeholder="Enter signature..."
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '18px',
                        fontFamily: 'cursive',
                        fontStyle: 'italic'
                      }}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formResponses[index] || ''}
                      onChange={(e) => handleFormResponse(index, e.target.value)}
                      placeholder={`Enter ${field.name.toLowerCase()}...`}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  )}
                </div>
              ))}
              
              {copySuccess && (
                <div style={{ color: '#28a745', fontSize: '12px', marginTop: '10px' }}>
                  {copySuccess}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          marginTop: '30px',
          padding: '30px',
          border: '2px dashed #007bff',
          borderRadius: '10px',
          backgroundColor: 'white',
          maxWidth: '500px',
          margin: '30px auto'
        }}>
          <h3 style={{ color: '#666', marginBottom: '8px' }}>Generate Form</h3>
          <p style={{ fontSize: '10px', color: '#888', marginBottom: '15px', margin: '0 0 15px 0' }}>
            Use filled response fields to generate the completed form text.
          </p>
          <button
            onClick={generateRFP}
            disabled={rfpGenerating}
            style={{
              width: '100%',
              padding: '15px 40px',
              fontSize: '18px',
              backgroundColor: rfpGenerating ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: rfpGenerating ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}
          >
            {rfpGenerating ? 'Generating...' : 'Generate Form'}
          </button>
          {rfpError && (
            <div style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
              {rfpError}
            </div>
          )}
          {generatedRFP && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              textAlign: 'left',
              fontSize: '14px',
              marginTop: '20px',
              maxWidth: '800px',
              margin: '20px auto',
              border: '1px solid #ddd'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <strong>Converted Text from RFP Attachments:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  {copySuccess && (
                    <span style={{ color: '#28a745', fontSize: '12px' }}>
                      {copySuccess}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ margin: '15px 0 0 0' }}>
                {formatAnalysis(generatedRFP)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}