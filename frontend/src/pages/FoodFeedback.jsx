import React, { useState } from 'react';
import { apiRequest } from '../api';

export default function FoodFeedback({ driverId, donationId }) {
    const [formData, setFormData] = useState({ name: '', rating: '5', comments: '' });
    const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatusMessage({ text: '', isError: false });

        try {
            const data = await apiRequest('/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ ...formData, driver_id: driverId, donation_id: donationId }),
            });

            setStatusMessage({ text: data.message || 'Thank you! Your feedback has been saved.', isError: false });
            setFormData({ name: '', rating: '5', comments: '' });
        } catch (error) {
            setStatusMessage({ text: error.message || 'Unable to save feedback.', isError: true });
            console.error('Submission error:', error);
        }
    };

    return (
        <div style={{ padding: '25px', maxWidth: '450px', margin: '40px auto', background: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#333', marginBottom: '20px', textAlign: 'center' }}>Food Feedback Form</h2>
            
            {statusMessage.text && (
                <p style={{ color: statusMessage.isError ? '#dc3545' : '#28a745', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px' }}>
                    {statusMessage.text}
                </p>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555' }}>Your Name:</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555' }}>Rating:</label>
                    <select name="rating" value={formData.rating} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', background: '#fff' }}>
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Good</option>
                        <option value="3">3 - Average</option>
                        <option value="2">2 - Poor</option>
                        <option value="1">1 - Terrible</option>
                    </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555' }}>Comments:</label>
                    <textarea name="comments" value={formData.comments} onChange={handleChange} rows="4" required style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', resize: 'vertical' }}></textarea>
                </div>

                <button type="submit" style={{ width: '100%', padding: '12px', background: '#007bff', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
                    Submit Feedback
                </button>
            </form>
        </div>
    );
}