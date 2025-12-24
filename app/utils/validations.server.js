export function validatePanamanianCedula(cedula) {
  if (!cedula || typeof cedula !== "string") {
    return { valid: false, error: "La cédula es requerida" };
  }

  const trimmedCedula = cedula.trim();

  const patterns = [
    /^[0-9]{1,2}-[0-9]{1,10}-[0-9]{1,10}$/, // Regular: provincia-libro-tomo
    /^PE-[0-9]{1,10}-[0-9]{1,10}$/, // Panameño nacido en el extranjero
    /^E-[0-9]{1,10}-[0-9]{1,10}$/, // Extranjero con cédula
    /^N-[0-9]{1,10}-[0-9]{1,10}$/, // Naturalizado
    /^[0-9]{1,2}AV-[0-9]{1,10}-[0-9]{1,10}$/, // Panameños nacidos antes de la vigencia
    /^[0-9]{1,2}PI-[0-9]{1,10}-[0-9]{1,10}$/, // Población indígena
  ];

  const isValid = patterns.some((pattern) => pattern.test(trimmedCedula));

  if (!isValid) {
    return {
      valid: false,
      error:
        "Formato de cédula inválido. Ejemplos válidos: 1-1234-12345, PE-1234-123456, E-1234-12345, N-1234-12345, 1AV-1234-12345, 1PI-1234-12345",
    };
  }

  return { valid: true };
}

export function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "El email es requerido" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmedEmail = email.trim();

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: "Formato de email inválido" };
  }

  return { valid: true };
}

export function validateName(name) {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "El nombre es requerido" };
  }

  const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    return { valid: false, error: "El nombre debe tener al menos 1 carácter" };
  }

  if (!nameRegex.test(trimmedName)) {
    return {
      valid: false,
      error: "El nombre solo puede contener letras y espacios",
    };
  }

  return { valid: true };
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "El teléfono es requerido" };
  }

  const phoneRegex = /^[0-9\-]+$/;
  const trimmedPhone = phone.trim();

  if (trimmedPhone.length < 1) {
    return { valid: false, error: "El teléfono es requerido" };
  }

  if (!phoneRegex.test(trimmedPhone)) {
    return {
      valid: false,
      error: "Formato de teléfono inválido. Solo se permiten números y guiones",
    };
  }

  return { valid: true };
}

export function validateRequiredField(value, fieldName) {
  if (!value || (typeof value === "string" && value.trim().length === 0)) {
    return { valid: false, error: `${fieldName} es requerido` };
  }
  return { valid: true };
}

export function validateDate(dateString) {
  if (!dateString || typeof dateString !== "string") {
    return { valid: false, error: "La fecha de nacimiento es requerida" };
  }

  const date = new Date(dateString);
  const today = new Date();

  if (isNaN(date.getTime())) {
    return { valid: false, error: "Fecha inválida" };
  }

  if (date > today) {
    return {
      valid: false,
      error: "La fecha de nacimiento no puede ser futura",
    };
  }

  return { valid: true };
}

export function validateCustomerData(data) {
  const errors = [];

  if (!data.document_type) {
    errors.push("Tipo de documento es requerido");
  } else if (!["cedula", "ruc", "pasaporte"].includes(data.document_type)) {
    errors.push("Tipo de documento inválido");
  }

  if (data.document_type === "cedula") {
    const cedulaValidation = validatePanamanianCedula(data.document_number);
    if (!cedulaValidation.valid) {
      errors.push(cedulaValidation.error);
    }
  } else if (
    data.document_type === "ruc" ||
    data.document_type === "pasaporte"
  ) {
    const docValidation = validateRequiredField(
      data.document_number,
      "Número de documento",
    );
    if (!docValidation.valid) {
      errors.push(docValidation.error);
    }
  }

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
    errors.push("Género es requerido");
  }

  const phoneValidation = validatePhone(data.phone);
  if (!phoneValidation.valid) {
    errors.push(phoneValidation.error);
  }

  if (!data.phone_country_code) {
    errors.push("Código de país del teléfono es requerido");
  }

  // Campos de ubicación:
  // - Requeridos solo para contribuyentes en Panamá (customer_type === '01' y document_type !== 'pasaporte')
  // - No requeridos para consumidor final (customer_type === '02')
  // - No requeridos para extranjeros (document_type === 'pasaporte')
  if (data.document_type !== "pasaporte" && data.customer_type === "01") {
    const provinceValidation = validateRequiredField(data.province, "Provincia");
    if (!provinceValidation.valid) {
      errors.push(provinceValidation.error);
    }

    const districtValidation = validateRequiredField(data.district, "Distrito");
    if (!districtValidation.valid) {
      errors.push(districtValidation.error);
    }

    const corregimientoValidation = validateRequiredField(
      data.corregimiento,
      "Corregimiento",
    );
    if (!corregimientoValidation.valid) {
      errors.push(corregimientoValidation.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
