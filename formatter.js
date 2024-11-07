function formatDate(dateStr) {
    if (!dateStr) return null;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Convert common phrases to dates
    const lowerDateStr = dateStr.toLowerCase();
    if (lowerDateStr === 'today') {
        return today.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
        });
    }
    if (lowerDateStr === 'tomorrow') {
        return tomorrow.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
        });
    }
    if (lowerDateStr.includes('next week')) {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return nextWeek.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // Return the original date string if no special formatting needed
    return dateStr;
}

function formatTask(task) {
    // Remove common task markers
    task = task.replace(/^(todo|task|reminder|note):/i, '');
    
    // Remove time-related phrases that might be at the start
    task = task.replace(/^(today|tomorrow|next week|by|before|after|on|at)\s+/i, '');
    
    // Remove common punctuation at the end
    task = task.replace(/[.!?]+$/, '');
    
    // Capitalize first letter
    task = task.charAt(0).toUpperCase() + task.slice(1);
    
    // Trim whitespace
    return task.trim();
}

module.exports = {
    formatDate,
    formatTask
}; 