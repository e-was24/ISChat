// Phone Number Formatting Utility for ISChat (Indonesia Focused)

export const formatPhoneInput = (value) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';

  // Case 1: Starts with 0 (e.g. 0812...) -> convert to 62812...
  let normalized = digits;
  if (digits.startsWith('0')) {
    normalized = '62' + digits.substring(1);
  }

  // Ensure it starts with 62 if not already
  if (!normalized.startsWith('62')) {
    normalized = '62' + normalized;
  }

  // Format: +62 8XX-XXXX-XXXX
  let formatted = '+62';
  const rest = normalized.substring(2);

  if (rest.length > 0) {
    formatted += ' ' + rest.substring(0, 3);
  }
  if (rest.length > 3) {
    formatted += '-' + rest.substring(3, 7);
  }
  if (rest.length > 7) {
    formatted += '-' + rest.substring(7, 11);
  }

  return formatted;
};

// Simple cleaner for comparison
export const cleanPhone = (value) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return '62' + digits.substring(1);
  return digits;
};
