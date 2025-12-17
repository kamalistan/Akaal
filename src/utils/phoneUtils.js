export function formatPhoneNumber(number, format = 'us') {
  if (!number) return '';

  const cleaned = number.replace(/\D/g, '');

  if (format === 'us') {
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return `+${cleaned.slice(0, cleaned.length - 10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
  }

  if (format === 'international') {
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 11) return `+${cleaned}`;
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
  }

  return cleaned;
}

export function validatePhoneNumber(number) {
  const cleaned = number.replace(/\D/g, '');

  if (cleaned.length === 0) {
    return { valid: false, error: 'Phone number is required' };
  }

  if (cleaned.length < 10) {
    return { valid: false, error: 'Phone number must be at least 10 digits' };
  }

  if (cleaned.length > 15) {
    return { valid: false, error: 'Phone number is too long' };
  }

  const emergencyNumbers = ['911', '112', '999'];
  if (emergencyNumbers.includes(cleaned.slice(0, 3))) {
    return { valid: false, error: 'Emergency numbers cannot be dialed from this app', isEmergency: true };
  }

  return { valid: true, cleaned };
}

export function normalizePhoneNumber(number, defaultCountryCode = '+1') {
  const cleaned = number.replace(/\D/g, '');

  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }

  if (cleaned.length === 10) {
    return `${defaultCountryCode}${cleaned}`;
  }

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  return `+${cleaned}`;
}

export function extractDigits(number) {
  return number.replace(/\D/g, '');
}

export function isValidPhoneCharacter(char) {
  return /[\d*#+\-\s()]/.test(char);
}

export function getCallDurationFormatted(seconds) {
  if (!seconds || seconds < 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function detectCountryCode(number) {
  const cleaned = number.replace(/\D/g, '');

  const countryCodes = {
    '1': { country: 'US/Canada', code: '+1', flag: '🇺🇸' },
    '44': { country: 'UK', code: '+44', flag: '🇬🇧' },
    '61': { country: 'Australia', code: '+61', flag: '🇦🇺' },
    '91': { country: 'India', code: '+91', flag: '🇮🇳' },
    '86': { country: 'China', code: '+86', flag: '🇨🇳' },
    '81': { country: 'Japan', code: '+81', flag: '🇯🇵' },
    '49': { country: 'Germany', code: '+49', flag: '🇩🇪' },
    '33': { country: 'France', code: '+33', flag: '🇫🇷' },
    '39': { country: 'Italy', code: '+39', flag: '🇮🇹' },
    '34': { country: 'Spain', code: '+34', flag: '🇪🇸' },
  };

  for (const [code, info] of Object.entries(countryCodes)) {
    if (cleaned.startsWith(code)) {
      return info;
    }
  }

  return { country: 'Unknown', code: '+1', flag: '🌍' };
}

export function getContactInitials(name) {
  if (!name) return '?';

  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function parsePhoneNumber(number) {
  const cleaned = extractDigits(number);
  const countryInfo = detectCountryCode(cleaned);
  const formatted = formatPhoneNumber(cleaned);
  const normalized = normalizePhoneNumber(cleaned);

  return {
    original: number,
    cleaned,
    formatted,
    normalized,
    countryInfo,
    isValid: validatePhoneNumber(number).valid
  };
}
