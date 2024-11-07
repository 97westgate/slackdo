function formatDate(dateString) {
  if (!dateString) return null;

  // Capitalize month names
  const capitalizeMonth = (str) => {
    return str.replace(/\b[a-z]+/g, (month) => {
      return month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
    });
  };

  // Format time to 12-hour format
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return ` at ${hour12}${minutes ? `:${minutes}` : ''} ${period}`;
  };

  let formattedDate = dateString.toLowerCase();
  
  // Extract and format time if present
  const timeMatch = formattedDate.match(/ at (\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  const timeStr = timeMatch ? formatTime(`${timeMatch[1]}:${timeMatch[2] || '00'}`) : '';
  
  // Remove existing time if any
  formattedDate = formattedDate.replace(/ at .*$/i, '');
  
  // Capitalize month names and add formatted time
  formattedDate = capitalizeMonth(formattedDate) + timeStr;

  return formattedDate;
}

module.exports = { formatDate }; 