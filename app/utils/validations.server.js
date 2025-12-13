export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'El email es requerido' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmedEmail = email.trim();

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Formato de email inválido' };
  }

  return { valid: true };
}

export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'El nombre es requerido' };
  }

  const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    return { valid: false, error: 'El nombre debe tener al menos 1 carácter' };
  }

  if (!nameRegex.test(trimmedName)) {
    return { valid: false, error: 'El nombre solo puede contener letras y espacios' };
  }

  return { valid: true };
}

export function validatePhone(phone) {
  console.log('[DEBUG PHONE BACKEND] Iniciando validación de teléfono en backend');
  console.log('[DEBUG PHONE BACKEND] Valor recibido:', phone);
  console.log('[DEBUG PHONE BACKEND] Tipo:', typeof phone);
  
  if (!phone || typeof phone !== 'string') {
    console.log('[DEBUG PHONE BACKEND] ERROR: Teléfono vacío o no es string');
    return { valid: false, error: 'El celular es requerido' };
  }

  const trimmedPhone = phone.trim();
  console.log('[DEBUG PHONE BACKEND] Valor después de trim:', trimmedPhone);
  console.log('[DEBUG PHONE BACKEND] Longitud:', trimmedPhone.length);

  if (trimmedPhone.length < 1) {
    console.log('[DEBUG PHONE BACKEND] ERROR: Teléfono vacío después de trim');
    return { valid: false, error: 'El celular es requerido' };
  }

  // Validar que no tenga guiones
  if (/-/.test(trimmedPhone)) {
    console.log('[DEBUG PHONE BACKEND] ERROR: Teléfono contiene guiones');
    return { valid: false, error: 'El celular no debe contener guiones' };
  }

  // Solo números
  if (!/^[0-9]+$/.test(trimmedPhone)) {
    console.log('[DEBUG PHONE BACKEND] ERROR: Teléfono contiene caracteres no numéricos');
    return { valid: false, error: 'El celular solo puede contener números' };
  }

  // Validar que tenga exactamente 8 dígitos
  if (trimmedPhone.length !== 8) {
    console.log('[DEBUG PHONE BACKEND] ERROR: Longitud incorrecta. Esperado: 8, Obtenido:', trimmedPhone.length);
    return { valid: false, error: 'El celular debe tener exactamente 8 dígitos' };
  }

  console.log('[DEBUG PHONE BACKEND] ✓ Teléfono válido');
  return { valid: true };
}

export function validateRequiredField(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return { valid: false, error: `${fieldName} es requerido` };
  }
  return { valid: true };
}

export function validateDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return { valid: false, error: 'La fecha de nacimiento es requerida' };
  }

  const date = new Date(dateString);
  const today = new Date();

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Fecha inválida' };
  }

  if (date > today) {
    return { valid: false, error: 'La fecha de nacimiento no puede ser futura' };
  }

  return { valid: true };
}

export function validateCustomerData(data) {
  const errors = [];

  // Campos siempre requeridos
  const firstNameValidation = validateName(data.first_name);
  if (!firstNameValidation.valid) {
    errors.push(firstNameValidation.error);
  }

  const lastNameValidation = validateName(data.last_name);
  if (!lastNameValidation.valid) {
    errors.push(lastNameValidation.error);
  }

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) {
    errors.push(emailValidation.error);
  }

  const dateValidation = validateDate(data.birth_date);
  if (!dateValidation.valid) {
    errors.push(dateValidation.error);
  }

  if (!data.gender) {
    errors.push('Género es requerido');
  } else if (!['M', 'F', 'X'].includes(data.gender)) {
    errors.push('Género inválido. Debe ser M, F o X');
  }

  const phoneValidation = validatePhone(data.phone);
  if (!phoneValidation.valid) {
    errors.push(phoneValidation.error);
  }

  // Validar customer_type
  if (!data.customer_type) {
    errors.push('Tipo de cliente es requerido');
  } else if (!['01', '02', '04'].includes(data.customer_type)) {
    errors.push('Tipo de cliente inválido');
  }

  // Validaciones condicionales según tipo de cliente
  if (data.customer_type === '01') {
    // Contribuyente
    const taxIdValidation = validateRequiredField(data.tax_id, 'Cédula o RUC');
    if (!taxIdValidation.valid) {
      errors.push(taxIdValidation.error);
    }

    const dvValidation = validateRequiredField(data.customer_dv, 'DV');
    if (!dvValidation.valid) {
      errors.push(dvValidation.error);
    }

    const taxpayerNameValidation = validateRequiredField(data.taxpayer_name, 'Razón Social');
    if (!taxpayerNameValidation.valid) {
      errors.push(taxpayerNameValidation.error);
    }

    if (!data.taxpayer_kind) {
      errors.push('Tipo de Contribuyente es requerido');
    } else if (!['1', '2'].includes(data.taxpayer_kind)) {
      errors.push('Tipo de Contribuyente inválido. Debe ser 1 (Natural) o 2 (Jurídico)');
    }
  } else if (data.customer_type === '02') {
    // Consumidor final
    const taxIdValidation = validateRequiredField(data.tax_id, 'Cédula');
    if (!taxIdValidation.valid) {
      errors.push(taxIdValidation.error);
    }

    // Razón Social es opcional para consumidor final (se auto-completa)
    // Pero si se proporciona, debe ser válido
    if (data.taxpayer_name && data.taxpayer_name.trim().length === 0) {
      // Está vacío, está bien (se auto-completa)
    }

    if (!data.taxpayer_kind) {
      errors.push('Tipo de Contribuyente es requerido');
    } else if (!['1', '2'].includes(data.taxpayer_kind)) {
      errors.push('Tipo de Contribuyente inválido. Debe ser 1 (Natural) o 2 (Jurídico)');
    }
  } else if (data.customer_type === '04') {
    // Extranjero
    const taxIdValidation = validateRequiredField(data.tax_id, 'Pasaporte o Identificación');
    if (!taxIdValidation.valid) {
      errors.push(taxIdValidation.error);
    }
  }

  // Campos de ubicación (solo para Panamá, pero no validamos país en backend)
  // Si customer_type es 01 o 02, asumimos que es Panamá
  if (data.customer_type === '01' || data.customer_type === '02') {
    const provinceValidation = validateRequiredField(data.province, 'Provincia');
    if (!provinceValidation.valid) {
      errors.push(provinceValidation.error);
    }

    const districtValidation = validateRequiredField(data.district, 'Distrito');
    if (!districtValidation.valid) {
      errors.push(districtValidation.error);
    }

    const corregimientoValidation = validateRequiredField(data.corregimiento, 'Corregimiento');
    if (!corregimientoValidation.valid) {
      errors.push(corregimientoValidation.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
