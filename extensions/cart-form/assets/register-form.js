(function () {
  "use strict";

  // Verificar que window.registerFormConfig esté disponible
  if (!window.registerFormConfig) {
    console.error(
      "window.registerFormConfig no está disponible. Asegúrate de que el script de configuración se cargue antes.",
    );
    return;
  }

  const API_BASE = "/apps/custom-invoice/customers";
  const LOGIN_URL = window.registerFormConfig.LOGIN_URL;
  const DGI_COUNTRY_CODES_URL = window.registerFormConfig.DGI_COUNTRY_CODES_URL;
  const SUPPORT_LINK = window.registerFormConfig.SUPPORT_LINK || "#";

  // Variables de elementos del DOM - se inicializarán en init()
  let toggle;
  let toggleText;
  let form;

  // Función auxiliar para actualizar el estilo del placeholder de selects
  function updateSelectPlaceholderStyle(select) {
    if (select && select.value === "") {
      select.style.color = "#b3b3b3";
    } else if (select) {
      select.style.color = "#000";
    }
  }

  function init() {
    // Inicializar referencias a elementos del DOM
    form = document.getElementById("register-form");

    // Verificar que el formulario exista
    // Si no existe, puede ser que el usuario esté logueado y no necesite el formulario
    if (!form) {
      // Verificar si hay un customer logueado (hay un botón de logout)
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        // El usuario está logueado, no necesitamos inicializar el formulario
        return;
      }
      
      // Si no hay botón de logout, intentar de nuevo (puede ser que el DOM aún no esté listo)
      console.warn(
        "Formulario no encontrado. Reintentando en 200ms...",
        { form: !!form }
      );
      setTimeout(init, 200);
      return;
    }
    
    console.log("Form elements found, initializing...");
    
    // Asegurar que el billing-section esté visible
    const billingSection = document.getElementById("billing-section");
    if (billingSection) {
      billingSection.style.display = "block";
    }
    
    // Configurar event listeners para "Resides en Panamá"
    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");

    if (residesPanamaYes) {
      residesPanamaYes.addEventListener("change", handleCountryChange);
    }
    if (residesPanamaNo) {
      residesPanamaNo.addEventListener("change", handleCountryChange);
    }

    // Inicializar el estado inicial de los campos
    setTimeout(() => {
      if (billingSection) {
        handleCountryChange();
      }
    }, 100);
    
    // Inicializar formulario
    setTimeout(() => {
      initForm();
    }, 100);
  }

  function loadCustomerDataOnInit() {
    if (!IS_LOGGED_IN) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    const wantsInvoice = saved ? JSON.parse(saved).wantsInvoice : false;

    if (!wantsInvoice) {
      return;
    }

    fetch(`${API_BASE}/get?customer_id=${CUSTOMER_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.complete && d.customer) {
          showCustomerDataSummary(d.customer);
          enableCheckout();
        } else {
          disableCheckout(d.missingFields || []);
        }
      })
      .catch((e) => {
        disableCheckout([]);
      });
  }

  function getLocationFromCode(code) {
    if (!locationHierarchy || !code) return null;

    for (const provincia in locationHierarchy) {
      for (const distrito in locationHierarchy[provincia]) {
        for (const corregimiento in locationHierarchy[provincia][distrito]) {
          if (locationHierarchy[provincia][distrito][corregimiento] === code) {
            return {
              province: provincia,
              district: distrito,
              corregimiento,
            };
          }
        }
      }
    }
    return null;
  }

  function showCustomerDataSummary(c) {
    const summaryContainer = document.getElementById("customer-data-summary");
    const summaryContent = document.getElementById(
      "customer-data-summary-content",
    );

    if (!summaryContainer || !summaryContent) return;

    if (c && c.metafields) {
      const mf = c.metafields || {};
      const isContribuyente = mf.ex_customer_type === "01";
      const customerTypeLabel =
        mf.ex_customer_type === "01"
          ? "Contribuyente"
          : mf.ex_customer_type === "02"
            ? "Consumidor final"
            : mf.ex_customer_type === "04"
              ? "Extranjero"
              : "";

      loadLocationData().then(() => {
        const locationData = getLocationFromCode(
          mf.ex_customer_location_code || "",
        );
        const address = locationData
          ? [
              locationData.corregimiento,
              locationData.district,
              locationData.province,
            ]
              .filter(Boolean)
              .join(", ")
          : "";

        const summaryItems = [];

        summaryItems.push(
          `<div class="customer-data-summary-item"><strong>${c.firstName || ""} ${c.lastName || ""}</strong></div>`,
        );

        if (customerTypeLabel) {
          summaryItems.push(
            `<div class="customer-data-summary-item">${customerTypeLabel}</div>`,
          );
        }

        if (mf.ex_tax_id) {
          summaryItems.push(
            `<div class="customer-data-summary-item">${mf.ex_tax_id}</div>`,
          );
        }

        if (mf.ex_taxpayer_name) {
          summaryItems.push(
            `<div class="customer-data-summary-item">${mf.ex_taxpayer_name}</div>`,
          );
        }

        if (isContribuyente && mf.ex_customer_dv) {
          summaryItems.push(
            `<div class="customer-data-summary-item">DV: ${mf.ex_customer_dv}</div>`,
          );
        }

        if (isContribuyente && address) {
          summaryItems.push(
            `<div class="customer-data-summary-item">${address}</div>`,
          );
        }

        summaryContent.innerHTML = summaryItems.join("\n");
        summaryContainer.style.display = "block";
      });
    }
  }

  function handleToggleChange(e) {
    e.preventDefault();
    const currentState = toggle.getAttribute("aria-checked") === "true";
    const newState = !currentState;
    toggle.setAttribute("aria-checked", String(newState));
    updateToggleText();
    
    const billingSection = document.getElementById("billing-section");
    if (billingSection) {
      billingSection.style.display = newState ? "block" : "none";
      
      // Si se muestra el billing-section, actualizar los campos condicionados
      if (newState) {
        setTimeout(() => {
          handleCountryChange();
        }, 50);
      }
    }
  }

  function updateToggleText() {
    const isChecked = toggle.getAttribute("aria-checked") === "true";
    toggleText.textContent = isChecked
      ? "Sí, quiero una factura personalizada"
      : "No, no quiero una factura personalizada";
  }

  function openModal(showErrors = false) {
    // Resetear banderas de envío al abrir el modal
    // Solo si no hay un customer_id (nuevo registro)
    const customerId = document.getElementById("customer_id")?.value;
    if (!customerId) {
      isSubmitting = false;
      isSuccessfullySubmitted = false;
    }

    if (modal) {
      const fd = document.getElementById("customer-form-container");
      const dd = document.getElementById("customer-data-display");
      const skeleton = document.getElementById("form-skeleton-loader");
      const actionUpdateBtn = document.getElementById("action-update-btn");

      if (fd) {
        fd.style.display = "none";
        fd.style.opacity = "0";
      }
      if (dd) {
        dd.style.display = "none";
        dd.style.opacity = "0";
      }
      if (skeleton) {
        skeleton.style.display = "none";
        skeleton.style.opacity = "0";
      }

      if (actionUpdateBtn) {
        actionUpdateBtn.textContent = IS_LOGGED_IN
          ? "Actualizar"
          : "Registrarse";
        actionUpdateBtn.disabled = false;
      }

      modal.showModal();

      modal.style.height = "200px";

      const form = document.getElementById("register-form");

      if (!showErrors) {
        if (form) {
          form.classList.remove("submitted");

          const errorFields = form.querySelectorAll(
            ".custom-invoice-input.error",
          );
          errorFields.forEach((field) => {
            field.classList.remove("error");
            const fieldId = field.id;
            if (fieldId) {
              const errorElement = document.getElementById(`${fieldId}_error`);
              if (errorElement) {
                errorElement.classList.remove("show");
                errorElement.textContent = "";
              }
            }
          });
        }
      }

      setTimeout(() => {
        initForm();

        taxpayerKindSelected = false;
        hideValidationIndicator();
        hideValidationMessage();

        setTimeout(() => {
          animateModalHeight();
        }, 50);

        setTimeout(() => {
          loadCustomerData();
        }, 50);
      }, 100);
    }
  }

  function closeModal() {
    if (modal) {
      modal.close();
      modal.style.height = "";
    }

    taxpayerKindSelected = false;
    hideValidationIndicator();
    hideValidationMessage();
    if (validationTimeout) {
      clearTimeout(validationTimeout);
      validationTimeout = null;
    }
    isValidating = false;
  }

  function savePreference(d) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }

  function getPreference() {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { wantsInvoice: false };
  }

  function checkCustomerDataCompleteness(openModalIfIncomplete = false) {
    if (IS_LOGGED_IN) {
      fetch(`${API_BASE}/get?customer_id=${CUSTOMER_ID}`)
        .then((r) => r.json())
        .then((d) => {
          // DEBUG TEMPORAL: Mostrar respuesta del API
          console.log("[DEBUG FRONTEND] Respuesta del API:", d);
          console.log("[DEBUG FRONTEND] Datos completos:", d.complete);

          if (d.complete && d.customer) {
            enableCheckout();
            showCustomerDataSummary(d.customer);
          } else {
            disableCheckout([]);

            if (openModalIfIncomplete) {
              openModal(true);
              setTimeout(() => {
                loadCustomerData();
                setTimeout(() => {
                  validateEmptyFormFields();
                }, 800);
              }, 100);
            }
          }
        })
        .catch((e) => {
          console.error(
            "[DEBUG FRONTEND] Error al obtener datos del cliente:",
            e,
          );
          disableCheckout([]);

          if (openModalIfIncomplete) {
            openModal(true);
            setTimeout(() => {
              loadCustomerData();
              setTimeout(() => {
                validateEmptyFormFields();
              }, 800);
            }, 100);
          }
        });
    } else {
      disableCheckout([]);

      if (openModalIfIncomplete) {
        openModal(true);
        setTimeout(() => {
          validateEmptyFormFields();
        }, 100);
      }
    }
  }

  function interceptCheckoutSubmit() {
    const cartForm =
      document.getElementById("cart") ||
      document.querySelector(
        'form[id*="cart"], form[action*="checkout"], form[action*="/checkout"]',
      );
    if (!cartForm) {
      setTimeout(interceptCheckoutSubmit, 500);
      return;
    }

    let customerDataComplete = null;

    if (IS_LOGGED_IN) {
      fetch(`${API_BASE}/get?customer_id=${CUSTOMER_ID}`)
        .then((r) => r.json())
        .then((d) => {
          customerDataComplete = d.complete && d.customer;
        })
        .catch((err) => {
          customerDataComplete = false;
        });
    }

    function handleCartSubmit(e) {
      const p = getPreference();

      if (!p.wantsInvoice) {
        return;
      }

      if (IS_LOGGED_IN) {
        if (customerDataComplete === true) {
          return;
        }

        if (customerDataComplete === false) {
          e.preventDefault();
          e.stopPropagation();
          openModal(true);
          setTimeout(() => {
            loadCustomerData();
            const form = document.getElementById("register-form");
            if (form) {
              form.classList.add("submitted");
            }
          }, 100);
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        fetch(`${API_BASE}/get?customer_id=${CUSTOMER_ID}`)
          .then((r) => r.json())
          .then((d) => {
            customerDataComplete = d.complete && d.customer;
            if (!d.complete || !d.customer) {
              openModal(true);
              setTimeout(() => {
                loadCustomerData();
                const form = document.getElementById("register-form");
                if (form) {
                  form.classList.add("submitted");
                  const allFields = form.querySelectorAll(
                    "input[required], select[required]",
                  );
                  allFields.forEach((field) => {
                    if (
                      !field.value ||
                      (field.value && field.value.trim() === "")
                    ) {
                      const fieldId = field.id;
                      if (fieldId) {
                        showFormError(fieldId, getFieldErrorMessage(fieldId));
                      }
                    }
                  });
                }
              }, 100);
            } else {
              cartForm.removeEventListener("submit", handleCartSubmit);

              window.location.href = "/checkout";
            }
          })
          .catch((err) => {
            customerDataComplete = false;
            openModal(true);
            setTimeout(() => {
              loadCustomerData();
              const form = document.getElementById("register-form");
              if (form) {
                form.classList.add("submitted");
              }
            }, 100);
          });
      } else {
        e.preventDefault();
        e.stopPropagation();
        openModal(true);
        setTimeout(() => {
          const form = document.getElementById("register-form");
          if (form) {
            form.classList.add("submitted");
            const allFields = form.querySelectorAll(
              "input[required], select[required]",
            );
            allFields.forEach((field) => {
              if (!field.value || (field.value && field.value.trim() === "")) {
                const fieldId = field.id;
                if (fieldId) {
                  showFormError(fieldId, getFieldErrorMessage(fieldId));
                }
              }
            });
          }
        }, 100);
      }
    }

    cartForm.addEventListener("submit", handleCartSubmit);
  }

  function getCheckoutButton() {
    let cb = document.getElementById("checkout");
    if (cb) return cb;

    cb = document.querySelector(
      'button[name="checkout"], input[name="checkout"]',
    );
    if (cb) return cb;

    const cartForm =
      document.getElementById("cart") ||
      document.querySelector(
        'form[id*="cart"], form[action*="checkout"], form[action*="/checkout"]',
      );
    if (cartForm) {
      cb = cartForm.querySelector(
        'button[type="submit"][name="checkout"], button#checkout, button[name="checkout"]',
      );
      if (cb) return cb;

      cb = cartForm.querySelector(
        'button[type="submit"], input[type="submit"]',
      );
      if (cb) return cb;
    }

    cb = document.querySelector(
      'button[form="cart"][name="checkout"], button[form="cart"]#checkout',
    );
    if (cb) return cb;

    return document.querySelector(
      'button[name*="checkout"], a[href*="checkout"]',
    );
  }

  function checkCheckoutButton() {
    const cb = getCheckoutButton();
    if (!cb) {
      setTimeout(checkCheckoutButton, 500);
      return;
    }

    const p = getPreference();
    if (p.wantsInvoice) {
      if (IS_LOGGED_IN) {
        loadCustomerDataOnInit();
      } else {
        disableCheckout();
      }
    } else {
      enableCheckout();
    }
  }

  function disableCheckout(missingFields = []) {
    const cb = getCheckoutButton();
    if (!cb) return;

    cb.style.opacity = "0.6";
    cb.style.cursor = "pointer";
    cb.style.position = "relative";
    cb.setAttribute("data-checkout-blocked", "true");
    cb.setAttribute("aria-disabled", "true");
    cb.setAttribute(
      "title",
      "Complete el formulario de factura personalizada para continuar",
    );

    if (!cb.hasAttribute("data-modal-listener-added")) {
      cb.setAttribute("data-modal-listener-added", "true");
      cb.addEventListener("click", handleBlockedCheckoutClick);
    }

    if (!cb.querySelector(".checkout-blocked-indicator")) {
      const indicator = document.createElement("span");
      indicator.className = "checkout-blocked-indicator";
      indicator.textContent = "⚠";
      indicator.style.cssText =
        "position: absolute; top: -8px; right: -8px; background: #ff6b6b; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 10;";
      cb.style.position = "relative";
      cb.appendChild(indicator);
    }

    // Mostrar mensaje de error debajo del toggle
    const errorElement = document.getElementById("checkout-blocked-error");
    if (errorElement) {
      errorElement.innerHTML = `
        Te hacen falta datos por completar. 
        <a href="#" id="open-form-link">Completa tus datos aquí</a>
      `;
      errorElement.classList.add("show");
      errorElement.style.display = ""; // Remover cualquier display inline que pueda estar bloqueando

      // Agregar listener al link
      const openFormLink = document.getElementById("open-form-link");
      if (openFormLink) {
        openFormLink.addEventListener("click", function (e) {
          e.preventDefault();
          handleBlockedCheckoutClick(e);
        });
      }
    }
  }

  function handleBlockedCheckoutClick(e) {
    const cb = getCheckoutButton();
    if (!cb) return;

    const isBlocked = cb.getAttribute("data-checkout-blocked") === "true";
    if (isBlocked) {
      e.preventDefault();
      e.stopPropagation();

      const p = getPreference();
      if (p.wantsInvoice) {
        openModal(true);

        setTimeout(() => {
          if (IS_LOGGED_IN) {
            // Si está logueado, cargar datos y luego validar campos vacíos del formulario
            loadCustomerData();
            // Esperar más tiempo para que el formulario se cargue completamente
            setTimeout(() => {
              validateEmptyFormFields();
            }, 800);
          } else {
            // Si no está logueado, validar todos los campos requeridos
            const form = document.getElementById("register-form");
            if (form) {
              form.classList.add("submitted");
              validateEmptyFormFields();
            }
          }
        }, 100);
      }
    }
  }

  function validateEmptyFormFields() {
    const form = document.getElementById("custom-invoice-form");
    if (!form) {
      // Si el formulario no existe, intentar de nuevo después de un breve delay
      setTimeout(() => validateEmptyFormFields(), 200);
      return;
    }

    console.log("[DEBUG FRONTEND] Validando campos vacíos del formulario");

    form.classList.add("submitted");

    // Determinar el tipo de cliente y si reside en Panamá
    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");
    const isPanama = residesPanamaYes && residesPanamaYes.checked;
    const isForeign = residesPanamaNo && residesPanamaNo.checked;

    const customerType01 = document.getElementById("customer_type_01");
    const customerType02 = document.getElementById("customer_type_02");
    const customerType04Validate = document.getElementById("customer_type_04");
    const customerType =
      customerType01 && customerType01.checked
        ? "01"
        : customerType02 && customerType02.checked
          ? "02"
          : customerType04Validate && customerType04Validate.checked
            ? "04"
            : "";

    // Campos siempre requeridos
    const alwaysRequired = [
      "first_name",
      "last_name",
      "email",
      "gender",
      "phone",
    ];

    // Validar campos siempre requeridos
    alwaysRequired.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) {
        const isEmpty =
          !field.value || (field.value && field.value.trim() === "");
        if (isEmpty) {
          console.log(`[DEBUG FRONTEND] Campo vacío: ${fieldId}`);
          showFormError(fieldId, getFieldErrorMessage(fieldId));
        }
      }
    });

    // Validar fecha de nacimiento (tres selects)
    const birthDay = document.getElementById("birth_day");
    const birthMonth = document.getElementById("birth_month");
    const birthYear = document.getElementById("birth_year");
    const birthDateMissing =
      (birthDay && (!birthDay.value || birthDay.value === "")) ||
      (birthMonth && (!birthMonth.value || birthMonth.value === "")) ||
      (birthYear && (!birthYear.value || birthYear.value === ""));

    if (birthDateMissing) {
      console.log("[DEBUG FRONTEND] Campo vacío: fecha de nacimiento");
      showFormError("birth_date", getFieldErrorMessage("birth_date"));
      // Agregar clase error a los selects individuales para indicar visualmente que hay un error
      if (birthDay && (!birthDay.value || birthDay.value === "")) {
        birthDay.classList.add("error");
      }
      if (birthMonth && (!birthMonth.value || birthMonth.value === "")) {
        birthMonth.classList.add("error");
      }
      if (birthYear && (!birthYear.value || birthYear.value === "")) {
        birthYear.classList.add("error");
      }
    }

    // Validar "Resides en Panamá"
    if (!isPanama && !isForeign) {
      console.log("[DEBUG FRONTEND] Campo vacío: resides_panama");
      showFormError("country_error", getFieldErrorMessage("country_error"));
    }

    // Validar tipo de cliente (solo si reside en Panamá)
    if (isPanama && !customerType) {
      console.log("[DEBUG FRONTEND] Campo vacío: customer_type");
      showFormError(
        "customer_type_error",
        getFieldErrorMessage("customer_type_error"),
      );
      // Marcar los radio cards de tipo de cliente con error
      if (customerType01) {
        customerType01.classList.add("error");
        const customerType01Label = customerType01.closest("label.radio-card");
        if (customerType01Label) {
          customerType01Label.classList.add("error");
        }
      }
      if (customerType02) {
        customerType02.classList.add("error");
        const customerType02Label = customerType02.closest("label.radio-card");
        if (customerType02Label) {
          customerType02Label.classList.add("error");
        }
      }
      if (customerType04Validate) {
        customerType04Validate.classList.add("error");
        const customerType04Label =
          customerType04Validate.closest("label.radio-card");
        if (customerType04Label) {
          customerType04Label.classList.add("error");
        }
      }
    }

    // Validar campos según tipo de cliente
    if (isPanama && customerType === "01") {
      // Contribuyente
      const taxIdContribuyente = document.getElementById(
        "tax_id_contribuyente",
      );
      if (
        taxIdContribuyente &&
        (!taxIdContribuyente.value || taxIdContribuyente.value.trim() === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: tax_id_contribuyente");
        showFormError(
          "tax_id_contribuyente",
          getFieldErrorMessage("tax_id_contribuyente"),
        );
      }

      const customerDv = document.getElementById("customer_dv");
      if (customerDv && (!customerDv.value || customerDv.value.trim() === "")) {
        console.log("[DEBUG FRONTEND] Campo vacío: customer_dv");
        showFormError("customer_dv", getFieldErrorMessage("customer_dv"));
      }

      const taxpayerName = document.getElementById(
        "taxpayer_name_contribuyente",
      );
      if (
        taxpayerName &&
        (!taxpayerName.value || taxpayerName.value.trim() === "")
      ) {
        console.log(
          "[DEBUG FRONTEND] Campo vacío: taxpayer_name_contribuyente",
        );
        showFormError(
          "taxpayer_name_contribuyente",
          getFieldErrorMessage("taxpayer_name_contribuyente"),
        );
      }

      // Validar tipo de contribuyente (radio buttons)
      const taxpayerKind1 = document.getElementById(
        "taxpayer_kind_contribuyente_1",
      );
      const taxpayerKind2 = document.getElementById(
        "taxpayer_kind_contribuyente_2",
      );
      const taxpayerKindSelected =
        (taxpayerKind1 && taxpayerKind1.checked) ||
        (taxpayerKind2 && taxpayerKind2.checked);

      if (!taxpayerKindSelected) {
        console.log(
          "[DEBUG FRONTEND] Campo vacío: taxpayer_kind_contribuyente",
        );
        showFormError(
          "taxpayer_kind_contribuyente_error",
          getFieldErrorMessage("taxpayer_kind_contribuyente_error"),
        );
        // Marcar los radio cards de tipo de contribuyente con error
        if (taxpayerKind1) {
          taxpayerKind1.classList.add("error");
          const taxpayerKind1Label = taxpayerKind1.closest("label.radio-card");
          if (taxpayerKind1Label) {
            taxpayerKind1Label.classList.add("error");
          }
        }
        if (taxpayerKind2) {
          taxpayerKind2.classList.add("error");
          const taxpayerKind2Label = taxpayerKind2.closest("label.radio-card");
          if (taxpayerKind2Label) {
            taxpayerKind2Label.classList.add("error");
          }
        }
      }

      // Campos de ubicación para contribuyente
      const province = document.getElementById("province");
      if (province && (!province.value || province.value === "")) {
        console.log("[DEBUG FRONTEND] Campo vacío: province");
        showFormError("province", getFieldErrorMessage("province"));
      }

      const district = document.getElementById("district");
      if (district && (!district.value || district.value === "")) {
        console.log("[DEBUG FRONTEND] Campo vacío: district");
        showFormError("district", getFieldErrorMessage("district"));
      }

      const corregimiento = document.getElementById("corregimiento");
      if (
        corregimiento &&
        (!corregimiento.value || corregimiento.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: corregimiento");
        showFormError("corregimiento", getFieldErrorMessage("corregimiento"));
      }
    } else if (isPanama && customerType === "02") {
      // Consumidor final
      const taxIdConsumidor = document.getElementById("tax_id_consumidor");
      if (
        taxIdConsumidor &&
        (!taxIdConsumidor.value || taxIdConsumidor.value.trim() === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: tax_id_consumidor");
        showFormError(
          "tax_id_consumidor",
          getFieldErrorMessage("tax_id_consumidor"),
        );
      }

      const taxpayerNameConsumidor = document.getElementById(
        "taxpayer_name_consumidor",
      );
      if (
        taxpayerNameConsumidor &&
        (!taxpayerNameConsumidor.value ||
          taxpayerNameConsumidor.value.trim() === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: taxpayer_name_consumidor");
        showFormError(
          "taxpayer_name_consumidor",
          getFieldErrorMessage("taxpayer_name_consumidor"),
        );
      }

      // Validar tipo de contribuyente para consumidor final (radio buttons)
      const taxpayerKindConsumidor1 = document.getElementById(
        "taxpayer_kind_consumidor_1",
      );
      const taxpayerKindConsumidor2 = document.getElementById(
        "taxpayer_kind_consumidor_2",
      );
      const taxpayerKindConsumidorSelected =
        (taxpayerKindConsumidor1 && taxpayerKindConsumidor1.checked) ||
        (taxpayerKindConsumidor2 && taxpayerKindConsumidor2.checked);

      if (!taxpayerKindConsumidorSelected) {
        console.log("[DEBUG FRONTEND] Campo vacío: taxpayer_kind_consumidor");
        showFormError(
          "taxpayer_kind_consumidor_error",
          getFieldErrorMessage("taxpayer_kind_consumidor_error"),
        );
        // Marcar los radio cards de tipo de contribuyente con error
        if (taxpayerKindConsumidor1) {
          taxpayerKindConsumidor1.classList.add("error");
          const taxpayerKindConsumidor1Label =
            taxpayerKindConsumidor1.closest("label.radio-card");
          if (taxpayerKindConsumidor1Label) {
            taxpayerKindConsumidor1Label.classList.add("error");
          }
        }
        if (taxpayerKindConsumidor2) {
          taxpayerKindConsumidor2.classList.add("error");
          const taxpayerKindConsumidor2Label =
            taxpayerKindConsumidor2.closest("label.radio-card");
          if (taxpayerKindConsumidor2Label) {
            taxpayerKindConsumidor2Label.classList.add("error");
          }
        }
      }

      // Validar campos de ubicación para Consumidor final
      const provinceConsumidor = document.getElementById("province_consumidor");
      if (
        provinceConsumidor &&
        (!provinceConsumidor.value || provinceConsumidor.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: province_consumidor");
        showFormError(
          "province_consumidor",
          getFieldErrorMessage("province_consumidor"),
        );
      }

      const districtConsumidor = document.getElementById("district_consumidor");
      if (
        districtConsumidor &&
        (!districtConsumidor.value || districtConsumidor.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: district_consumidor");
        showFormError(
          "district_consumidor",
          getFieldErrorMessage("district_consumidor"),
        );
      }

      const corregimientoConsumidor = document.getElementById(
        "corregimiento_consumidor",
      );
      if (
        corregimientoConsumidor &&
        (!corregimientoConsumidor.value || corregimientoConsumidor.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: corregimiento_consumidor");
        showFormError(
          "corregimiento_consumidor",
          getFieldErrorMessage("corregimiento_consumidor"),
        );
      }
    } else if (isPanama && customerType === "04") {
      // Extranjero
      const taxIdExtranjero = document.getElementById("tax_id_extranjero");
      if (
        taxIdExtranjero &&
        (!taxIdExtranjero.value || taxIdExtranjero.value.trim() === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: tax_id_extranjero");
        showFormError(
          "tax_id_extranjero",
          getFieldErrorMessage("tax_id_extranjero"),
        );
      }

      const taxpayerNameExtranjero = document.getElementById(
        "taxpayer_name_extranjero",
      );
      if (
        taxpayerNameExtranjero &&
        (!taxpayerNameExtranjero.value ||
          taxpayerNameExtranjero.value.trim() === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: taxpayer_name_extranjero");
        showFormError(
          "taxpayer_name_extranjero",
          getFieldErrorMessage("taxpayer_name_extranjero"),
        );
      }

      // Validar campos de ubicación para Extranjero
      const provinceExtranjero = document.getElementById("province_extranjero");
      if (
        provinceExtranjero &&
        (!provinceExtranjero.value || provinceExtranjero.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: province_extranjero");
        showFormError(
          "province_extranjero",
          getFieldErrorMessage("province_extranjero"),
        );
      }

      const districtExtranjero = document.getElementById("district_extranjero");
      if (
        districtExtranjero &&
        (!districtExtranjero.value || districtExtranjero.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: district_extranjero");
        showFormError(
          "district_extranjero",
          getFieldErrorMessage("district_extranjero"),
        );
      }

      const corregimientoExtranjero = document.getElementById(
        "corregimiento_extranjero",
      );
      if (
        corregimientoExtranjero &&
        (!corregimientoExtranjero.value || corregimientoExtranjero.value === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: corregimiento_extranjero");
        showFormError(
          "corregimiento_extranjero",
          getFieldErrorMessage("corregimiento_extranjero"),
        );
      }
    } else if (isForeign) {
      // Extranjero
      const taxIdForeign = document.getElementById("tax_id_foreign");
      if (
        taxIdForeign &&
        (!taxIdForeign.value || taxIdForeign.value.trim() === "")
      ) {
        console.log("[DEBUG FRONTEND] Campo vacío: tax_id_foreign");
        showFormError("tax_id_foreign", getFieldErrorMessage("tax_id_foreign"));
      }
    }
  }

  function getFieldErrorMessage(fieldId) {
    const errorMessages = {
      first_name: "Ingresa tu nombre",
      last_name: "Ingresa tu apellido",
      email: "Ingresa tu correo electrónico",
      birth_date: "Selecciona tu fecha de nacimiento",
      birth_day: "Selecciona tu fecha de nacimiento",
      birth_month: "Selecciona tu fecha de nacimiento",
      birth_year: "Selecciona tu fecha de nacimiento",
      gender: "Selecciona tu género",
      phone: "Ingresa tu número de teléfono",
      country_error: "Selecciona si resides en Panamá",
      resides_panama: "Selecciona si resides en Panamá",
      customer_type_error: "Selecciona el tipo de cliente",
      customer_type: "Selecciona el tipo de cliente",
      tax_id_contribuyente: "Ingresa tu cédula o RUC",
      tax_id_consumidor: "Ingresa tu cédula",
      tax_id_extranjero: "Ingresa tu pasaporte o identificación",
      tax_id_foreign: "Ingresa tu pasaporte o identificación",
      customer_dv: "Ingresa el dígito verificador",
      taxpayer_name_contribuyente: "Ingresa tu razón social",
      taxpayer_name_consumidor: "Ingresa tu nombre completo",
      taxpayer_name_extranjero: "Ingresa tu nombre completo",
      taxpayer_kind_contribuyente_error: "Selecciona el tipo de contribuyente",
      taxpayer_kind_consumidor_error: "Selecciona el tipo de contribuyente",
      province: "Selecciona tu provincia",
      district: "Selecciona tu distrito",
      corregimiento: "Selecciona tu corregimiento",
      province_consumidor: "Selecciona tu provincia",
      district_consumidor: "Selecciona tu distrito",
      corregimiento_consumidor: "Selecciona tu corregimiento",
      province_extranjero: "Selecciona tu provincia",
      district_extranjero: "Selecciona tu distrito",
      corregimiento_extranjero: "Selecciona tu corregimiento",
    };
    return errorMessages[fieldId] || "Completa este campo";
  }

  function showFormError(fieldId, message) {
    // Si el fieldId ya termina en _error, es un elemento de error directo, no un campo
    const isErrorElement = fieldId.endsWith("_error");
    const errorElementId = isErrorElement ? fieldId : `${fieldId}_error`;
    const errorElement = document.getElementById(errorElementId);

    // Solo buscar el campo si NO es un elemento de error directo
    if (!isErrorElement) {
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.add("error");
        console.log(
          `[DEBUG] Clase error agregada a campo: ${fieldId}, tiene clase error: ${field.classList.contains("error")}`,
        );
      } else {
        console.warn(`[DEBUG] No se encontró campo: ${fieldId}`);
      }
    }

    if (errorElement) {
      // Limpiar contenido previo y establecer el ícono y texto del mensaje
      // Insertar el ícono directamente en el HTML en lugar de usar ::before
      const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eb4b6d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.6rem; height: 1.6rem; flex-shrink: 0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      errorElement.innerHTML = `${iconSvg}<span>${message}</span>`;
      errorElement.classList.add("show");
      // Forzar display para asegurar que se muestre
      errorElement.style.display = "flex";
      errorElement.style.alignItems = "center";
      errorElement.style.gap = "0.5rem";
      errorElement.style.width = "100%";
      console.log(
        `[DEBUG] Error mostrado: ${errorElementId}, message="${message}", innerHTML="${errorElement.innerHTML.substring(0, 100)}..."`,
      );
    } else {
      console.warn(
        `[DEBUG] No se encontró elemento de error: ${errorElementId}`,
      );
    }
  }

  function enableCheckout() {
    const cb = getCheckoutButton();
    if (!cb) return;

    cb.disabled = false;
    cb.style.opacity = "1";
    cb.style.cursor = "pointer";
    cb.removeAttribute("aria-disabled");
    cb.removeAttribute("data-checkout-blocked");
    cb.removeAttribute("data-missing-fields");
    cb.removeAttribute("title");

    const indicator = cb.querySelector(".checkout-blocked-indicator");
    if (indicator) {
      indicator.remove();
    }

    if (cb.tagName === "A") {
      cb.style.pointerEvents = "auto";
    }

    // Ocultar mensaje de error
    const errorElement = document.getElementById("checkout-blocked-error");
    if (errorElement) {
      errorElement.classList.remove("show");
      errorElement.style.display = "none";
      errorElement.innerHTML = "";
    }
  }

  function loadCustomerData() {
    if (IS_LOGGED_IN) {
      const skeleton = document.getElementById("form-skeleton-loader");
      const dd = document.getElementById("customer-data-display");
      const fd = document.getElementById("customer-form-container");
      const actionCancelBtn = document.getElementById("action-cancel-btn");
      const actionUpdateBtn = document.getElementById("action-update-btn");

      if (dd) {
        dd.style.display = "none";
        dd.style.opacity = "0";
      }
      if (fd) {
        fd.style.display = "none";
        fd.style.opacity = "0";
      }

      if (skeleton) {
        skeleton.style.display = "block";
        skeleton.style.opacity = "0";
        requestAnimationFrame(() => {
          skeleton.style.opacity = "1";

          setTimeout(() => {
            animateModalHeight();
          }, 50);
        });
      }

      if (actionCancelBtn) actionCancelBtn.disabled = true;
      if (actionUpdateBtn) actionUpdateBtn.disabled = true;

      fetch(`${API_BASE}/get?customer_id=${CUSTOMER_ID}`)
        .then((r) => r.json())
        .then((d) => {
          if (skeleton) {
            skeleton.style.opacity = "0";
            setTimeout(() => {
              skeleton.style.display = "none";

              animateModalHeight();
            }, 300);
          } else {
            setTimeout(() => {
              animateModalHeight();
            }, 50);
          }

          if (actionCancelBtn) actionCancelBtn.disabled = false;
          if (actionUpdateBtn) actionUpdateBtn.disabled = false;

          showUpdateForm(d.customer);
        })
        .catch((e) => {
          if (skeleton) {
            skeleton.style.opacity = "0";
            setTimeout(() => {
              skeleton.style.display = "none";
            }, 300);
          }

          if (actionCancelBtn) actionCancelBtn.disabled = false;
          if (actionUpdateBtn) actionUpdateBtn.disabled = false;
          showUpdateForm();
        });
    }
  }

  function showCustomerData(c) {
    showUpdateForm(c);
  }

  function animateModalHeight() {
    const modal = document.getElementById("custom-invoice-modal");
    const modalContent = document.querySelector(
      ".custom-invoice-modal-content",
    );
    if (!modal || !modalContent) return;

    const actionContainer = document.querySelector(".action-container");
    const contentHeight = modalContent.scrollHeight;
    const actionHeight = actionContainer ? actionContainer.offsetHeight : 0;
    const newHeight = contentHeight + actionHeight;

    const currentHeight = modal.style.height
      ? parseInt(modal.style.height)
      : modal.offsetHeight;

    if (Math.abs(currentHeight - newHeight) > 1) {
      if (!modal.style.height) {
        modal.style.height = currentHeight + "px";
      }

      void modal.offsetHeight;

      requestAnimationFrame(() => {
        modal.style.height = newHeight + "px";
      });
    } else if (!modal.style.height) {
      modal.style.height = newHeight + "px";
    }
  }

  function showUpdateForm(c) {
    const dd = document.getElementById("customer-data-display");
    const fd = document.getElementById("customer-form-container");
    const actionUpdateBtn = document.getElementById("action-update-btn");

    if (actionUpdateBtn) {
      actionUpdateBtn.disabled = false;
      actionUpdateBtn.textContent = IS_LOGGED_IN ? "Actualizar" : "Registrarse";
    }

    if (dd) {
      dd.style.opacity = "0";
      setTimeout(() => {
        dd.style.display = "none";
      }, 300);
    }

    if (fd) {
      fd.style.display = "block";
      fd.style.opacity = "0";

      requestAnimationFrame(() => {
        fd.style.opacity = "1";

        setTimeout(() => {
          animateModalHeight();
        }, 50);
      });
    }

    if (c && c.metafields) {
      populateForm(c);

      // Setup immutable fields después de que todos los campos estén poblados
      setTimeout(() => {
        setupImmutableFields(c);
      }, 300);

      // Asegurar que todos los selects tengan el estilo correcto después de cargar datos
      // También verificar que el valor de la provincia persista
      setTimeout(() => {
        const form = document.getElementById("register-form");
        if (form) {
          const allSelects = form.querySelectorAll(
            "select.custom-invoice-input",
          );
          allSelects.forEach((select) => {
            updateSelectPlaceholderStyle(select);
          });

          // Verificar que la provincia tenga su valor si hay un location_code
          const locationCodeInput = document.getElementById("location_code");
          if (locationCodeInput && locationCodeInput.value) {
            const locationCode = locationCodeInput.value;
            loadLocationData().then(() => {
              if (locationHierarchy) {
                for (const provincia in locationHierarchy) {
                  for (const distrito in locationHierarchy[provincia]) {
                    for (const corregimiento in locationHierarchy[provincia][
                      distrito
                    ]) {
                      if (
                        locationHierarchy[provincia][distrito][
                          corregimiento
                        ] === locationCode
                      ) {
                        const provinceSelect =
                          document.getElementById("province");
                        if (
                          provinceSelect &&
                          provinceSelect.value !== provincia
                        ) {
                          // Asegurar que el select de provincia esté poblado
                          if (provinceSelect.options.length <= 1) {
                            populateProvinceSelect();
                          }
                          provinceSelect.value = provincia;
                          updateSelectPlaceholderStyle(provinceSelect);
                        }
                        return;
                      }
                    }
                  }
                }
              }
            });
          }
        }
        animateModalHeight();
      }, 200);
    } else {
      setTimeout(() => {
        animateModalHeight();
      }, 100);
    }
  }

  function populateForm(c) {
    const mf = c.metafields || {};
    const f = document.getElementById("custom-invoice-form");
    if (!f) return;

    const firstNameField = document.getElementById("first_name");
    const lastNameField = document.getElementById("last_name");
    const emailField = document.getElementById("email");
    const birthDateField = document.getElementById("birth_date");
    const genderField = document.getElementById("gender");
    const phoneField = document.getElementById("phone");

    if (firstNameField && c.firstName) firstNameField.value = c.firstName;
    if (lastNameField && c.lastName) lastNameField.value = c.lastName;
    if (emailField && c.email) emailField.value = c.email;

    if (mf.ex_birthday) {
      const birthDateStr = mf.ex_birthday;

      const dateParts = birthDateStr.split("-");
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];

        const birthDay = document.getElementById("birth_day");
        const birthMonth = document.getElementById("birth_month");
        const birthYear = document.getElementById("birth_year");

        if (birthDay) {
          birthDay.value = String(parseInt(day, 10));
          updateSelectPlaceholderStyle(birthDay);
        }
        if (birthMonth) {
          birthMonth.value = month;
          updateSelectPlaceholderStyle(birthMonth);
        }
        if (birthYear) {
          birthYear.value = year;
          updateSelectPlaceholderStyle(birthYear);
        }

        updateBirthDateField();
      }
    }
    if (genderField && mf.ex_gender) {
      genderField.value = mf.ex_gender;
      updateSelectPlaceholderStyle(genderField);
    }
    if (phoneField && mf.ex_phone) phoneField.value = mf.ex_phone;

    // Mascotas (ex_segmentation es una lista JSON)
    if (mf.ex_segmentation) {
      try {
        const segmentationArray = JSON.parse(mf.ex_segmentation);
        if (Array.isArray(segmentationArray)) {
          segmentationArray.forEach((option) => {
            const checkbox = document.querySelector(
              `input[name="segmentation[]"][value="${option}"]`,
            );
            if (checkbox) {
              checkbox.checked = true;
            }
          });
        }
      } catch (e) {
        console.warn("No se pudo parsear ex_segmentation", e);
      }
    }

    const customerType = mf.ex_customer_type;

    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");

    if (customerType === "04") {
      if (residesPanamaNo) {
        residesPanamaNo.checked = true;
        residesPanamaNo.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else {
      if (residesPanamaYes) {
        residesPanamaYes.checked = true;
        residesPanamaYes.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    setTimeout(() => {
      handleCountryChange();
    }, 50);

    if (customerType === "04") {
      const taxIdForeign = document.getElementById("tax_id_foreign");
      const customerTypeForeign = document.getElementById(
        "customer_type_foreign",
      );

      // Ocultar el campo de tipo de cliente y establecer automáticamente "Extranjero" (04)
      const customerTypeForeignGroup = document.getElementById(
        "customer_type_foreign_group",
      );
      if (customerTypeForeignGroup) {
        customerTypeForeignGroup.style.display = "none";
      }

      if (taxIdForeign && mf.ex_tax_id) {
        taxIdForeign.value = mf.ex_tax_id;
        // Marcar como inmutable para setupImmutableFields
      }
      if (customerTypeForeign) {
        customerTypeForeign.value = "04";
      }
    } else if (
      customerType === "01" ||
      customerType === "02" ||
      customerType === "04"
    ) {
      const customerType01 = document.getElementById("customer_type_01");
      const customerType02 = document.getElementById("customer_type_02");
      const customerType04 = document.getElementById("customer_type_04");
      if (customerType === "01" && customerType01) {
        customerType01.checked = true;
        customerType01.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (customerType === "02" && customerType02) {
        customerType02.checked = true;
        customerType02.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (customerType === "04" && customerType04) {
        customerType04.checked = true;
        customerType04.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setTimeout(() => {
        handleCustomerTypeChange();
      }, 50);

      if (customerType === "01") {
        const taxIdContribuyente = document.getElementById(
          "tax_id_contribuyente",
        );
        const customerDv = document.getElementById("customer_dv");
        const taxpayerNameContribuyente = document.getElementById(
          "taxpayer_name_contribuyente",
        );

        if (taxIdContribuyente && mf.ex_tax_id) {
          taxIdContribuyente.value = mf.ex_tax_id;
          // Marcar como inmutable para setupImmutableFields
        }
        if (customerDv && mf.ex_customer_dv) {
          customerDv.value = mf.ex_customer_dv;
          const dvGroup = customerDv.closest(".custom-invoice-form-group");
          if (dvGroup && mf.ex_customer_dv) dvGroup.style.display = "flex";
        }
        if (taxpayerNameContribuyente && mf.ex_taxpayer_name) {
          taxpayerNameContribuyente.value = mf.ex_taxpayer_name;
          const razonGroup = taxpayerNameContribuyente.closest(
            ".custom-invoice-form-group",
          );
          if (razonGroup && mf.ex_taxpayer_name)
            razonGroup.style.display = "flex";
        }

        const taxpayerKindValue = mf.ex_taxpayer_kind || "";
        if (taxpayerKindValue) {
          const taxpayerKindRadio = document.getElementById(
            `taxpayer_kind_contribuyente_${taxpayerKindValue}`,
          );
          if (taxpayerKindRadio) {
            taxpayerKindRadio.checked = true;
            taxpayerKindSelected = true;
            setTimeout(() => {
              showValidationIconIfValid();
            }, 100);
          }
        }
      }

      if (customerType === "02") {
        const taxIdConsumidor = document.getElementById("tax_id_consumidor");
        const taxpayerNameConsumidor = document.getElementById(
          "taxpayer_name_consumidor",
        );

        if (taxIdConsumidor && mf.ex_tax_id) {
          taxIdConsumidor.value = mf.ex_tax_id;
          // Marcar como inmutable para setupImmutableFields
        }
        if (taxpayerNameConsumidor && mf.ex_taxpayer_name)
          taxpayerNameConsumidor.value = mf.ex_taxpayer_name;

        // Ocultar el campo de tipo de contribuyente y establecer automáticamente "Natural" (1)
        const taxpayerKindConsumidorGroup = document.getElementById(
          "taxpayer_kind_consumidor_group",
        );
        if (taxpayerKindConsumidorGroup) {
          taxpayerKindConsumidorGroup.style.display = "none";
        }

        // Establecer automáticamente el valor "Natural" (1)
        const taxpayerKindConsumidor1 = document.getElementById(
          "taxpayer_kind_consumidor_1",
        );
        if (taxpayerKindConsumidor1) {
          taxpayerKindConsumidor1.checked = true;
        }
      }

      if (mf.ex_customer_location_code) {
        const locationCode = mf.ex_customer_location_code;

        // Determinar qué campos de ubicación usar según el tipo de cliente
        const isConsumidorFinal = customerType === "02";
        const isExtranjero = customerType === "04";
        const locationCodeInputId = isConsumidorFinal
          ? "location_code_consumidor"
          : isExtranjero
            ? "location_code_extranjero"
            : "location_code";
        const locationCodeInput = document.getElementById(locationCodeInputId);
        if (locationCodeInput) {
          locationCodeInput.value = locationCode;
        }

        loadLocationData().then(() => {
          if (locationHierarchy) {
            // Buscar y establecer los valores
            for (const provincia in locationHierarchy) {
              for (const distrito in locationHierarchy[provincia]) {
                for (const corregimiento in locationHierarchy[provincia][
                  distrito
                ]) {
                  if (
                    locationHierarchy[provincia][distrito][corregimiento] ===
                    locationCode
                  ) {
                    if (isConsumidorFinal) {
                      // Cargar datos en campos de consumidor final
                      populateProvinceSelectConsumidor();
                      const provinceSelect = document.getElementById(
                        "province_consumidor",
                      );
                      const districtSelect = document.getElementById(
                        "district_consumidor",
                      );
                      const corregimientoSelect = document.getElementById(
                        "corregimiento_consumidor",
                      );

                      if (provinceSelect) {
                        provinceSelect.value = provincia;
                        updateSelectPlaceholderStyle(provinceSelect);
                        populateDistrictSelectConsumidor(provincia);

                        setTimeout(() => {
                          if (districtSelect) {
                            districtSelect.value = distrito;
                            updateSelectPlaceholderStyle(districtSelect);
                            populateCorregimientoSelectConsumidor(
                              provincia,
                              distrito,
                            );

                            setTimeout(() => {
                              if (corregimientoSelect) {
                                corregimientoSelect.value = corregimiento;
                                updateSelectPlaceholderStyle(
                                  corregimientoSelect,
                                );
                              }
                            }, 150);
                          }
                        }, 150);
                      }
                    } else if (isExtranjero) {
                      // Cargar datos en campos de extranjero
                      populateProvinceSelectExtranjero();
                      const provinceSelect = document.getElementById(
                        "province_extranjero",
                      );
                      const districtSelect = document.getElementById(
                        "district_extranjero",
                      );
                      const corregimientoSelect = document.getElementById(
                        "corregimiento_extranjero",
                      );

                      if (provinceSelect) {
                        provinceSelect.value = provincia;
                        updateSelectPlaceholderStyle(provinceSelect);
                        populateDistrictSelectExtranjero(provincia);

                        setTimeout(() => {
                          if (districtSelect) {
                            districtSelect.value = distrito;
                            updateSelectPlaceholderStyle(districtSelect);
                            populateCorregimientoSelectExtranjero(
                              provincia,
                              distrito,
                            );

                            setTimeout(() => {
                              if (corregimientoSelect) {
                                corregimientoSelect.value = corregimiento;
                                updateSelectPlaceholderStyle(
                                  corregimientoSelect,
                                );
                              }
                            }, 150);
                          }
                        }, 150);
                      }
                    } else {
                      // Cargar datos en campos de contribuyente
                      populateProvinceSelect();
                      const provinceSelect =
                        document.getElementById("province");
                      const districtSelect =
                        document.getElementById("district");
                      const corregimientoSelect =
                        document.getElementById("corregimiento");

                      if (provinceSelect) {
                        provinceSelect.value = provincia;
                        updateSelectPlaceholderStyle(provinceSelect);
                        populateDistrictSelect(provincia);

                        setTimeout(() => {
                          if (districtSelect) {
                            districtSelect.value = distrito;
                            updateSelectPlaceholderStyle(districtSelect);
                            populateCorregimientoSelect(provincia, distrito);

                            setTimeout(() => {
                              if (corregimientoSelect) {
                                corregimientoSelect.value = corregimiento;
                                updateSelectPlaceholderStyle(
                                  corregimientoSelect,
                                );
                              }
                            }, 150);
                          }
                        }, 150);
                      }
                    }
                    return;
                  }
                }
              }
            }
          }
        });
      }

      if (customerType === "02") {
        setTimeout(() => {
          updateRazonSocial();
        }, 100);
      }
    }
  }

  function setupImmutableFields(c) {
    const mf = c.metafields || {};
    const SUPPORT_LINK = window.config?.SUPPORT_LINK || "#";

    // Si el campo tax_id_contribuyente está deshabilitado y tiene valor,
    // significa que ya fue validado previamente, así que marcar como validado
    const taxIdContribuyente = document.getElementById("tax_id_contribuyente");
    if (
      taxIdContribuyente &&
      taxIdContribuyente.disabled &&
      taxIdContribuyente.value &&
      taxIdContribuyente.value.trim()
    ) {
      contribuyenteValidationSuccess = true;
    }

    // Deshabilitar campos de tax_id si ex_tax_id ya está guardado (inmutable)
    // Esto aplica a todos los tipos de cliente una vez que ex_tax_id ha sido guardado
    const taxIdFields = [
      "tax_id_contribuyente",
      "tax_id_consumidor",
      "tax_id_extranjero",
      "tax_id_foreign",
    ];

    // Si ex_tax_id existe en metafields, todos los campos de tax_id deben ser inmutables
    if (mf.ex_tax_id && mf.ex_tax_id.trim() !== "") {
      taxIdFields.forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) {
          // Establecer el valor de ex_tax_id en todos los campos
          field.value = mf.ex_tax_id;

          // Deshabilitar el campo
          field.disabled = true;
          field.style.cursor = "default";
          field.style.backgroundColor = "#f5f5f5";
          field.style.color = "#666";

          // Agregar mensaje de advertencia siempre visible
          const warningId = `${fieldId}_immutable_warning`;
          let warningElement = document.getElementById(warningId);
          if (!warningElement) {
            warningElement = document.createElement("div");
            warningElement.id = warningId;
            warningElement.className = "immutable-field-warning";

            // Insertar después del campo o del contenedor .input-with-validation
            const formGroup = field.closest(".custom-invoice-form-group");
            const inputContainer = field.closest(".input-with-validation");

            if (inputContainer && inputContainer.parentNode) {
              // Para contribuyente que tiene .input-with-validation
              inputContainer.parentNode.insertBefore(
                warningElement,
                inputContainer.nextSibling,
              );
            } else if (formGroup) {
              // Para consumidor y extranjero que no tienen .input-with-validation
              // Insertar después del campo, antes del error
              const errorElement = formGroup.querySelector(`#${fieldId}_error`);
              if (errorElement) {
                formGroup.insertBefore(warningElement, errorElement);
              } else {
                // Si no hay error element, insertar después del campo
                field.parentNode.insertBefore(
                  warningElement,
                  field.nextSibling,
                );
              }
            } else {
              // Fallback: insertar después del campo
              field.parentNode.insertBefore(warningElement, field.nextSibling);
            }
          }

          warningElement.innerHTML = `
            <div style="margin-top: 0.4rem; color: #666; font-size: 1.3rem; line-height: 1.4; user-select: none;">
              Este dato no se puede modificar. Si necesitas cambiarlo, 
              <a href="${SUPPORT_LINK}" target="_blank" style="color: #000; text-decoration: underline; user-select: none;">contáctanos</a>.
            </div>
          `;
        }
      });
    }

    // Deshabilitar cambio de "Resides en Panamá" si ya está guardado
    const customerType = mf.ex_customer_type;
    if (customerType) {
      const residesPanamaYes = document.getElementById("resides_panama_yes");
      const residesPanamaNo = document.getElementById("resides_panama_no");

      if (residesPanamaYes && residesPanamaNo) {
        residesPanamaYes.disabled = true;
        residesPanamaNo.disabled = true;
        residesPanamaYes.style.cursor = "not-allowed";
        residesPanamaNo.style.cursor = "not-allowed";

        // Ocultar visualmente pero mantener accesibilidad
        const radioGroup = residesPanamaYes.closest(".radix-radio-group");
        if (radioGroup) {
          radioGroup.style.opacity = "0.6";
        }
      }
    }
  }

  function handleStorageChange(e) {
    if (e.key === STORAGE_KEY) {
      const p = getPreference();
      toggle.setAttribute("aria-checked", String(p.wantsInvoice));
      updateToggleText();
      checkCheckoutButton();
    }
  }

  window.enableCheckoutAfterUpdate = function () {
    enableCheckout();
    savePreference({ wantsInvoice: true, dataComplete: true });
  };

  window.getLoginUrl = function () {
    return LOGIN_URL;
  };

  let locationHierarchy = null;
  let locationDataLoaded = false;

  async function loadLocationData() {
    if (locationDataLoaded) {
      console.log("Location data already loaded");
      return locationHierarchy;
    }

    console.log("Loading location data from:", DGI_COUNTRY_CODES_URL);
    try {
      const response = await fetch(DGI_COUNTRY_CODES_URL);
      if (!response.ok) {
        console.error("Error loading location data:", response.status, response.statusText);
        return null;
      }
      const jsonData = await response.json();
      console.log("Location data received, building hierarchy...");
      locationHierarchy = buildLocationHierarchy(jsonData);
      locationDataLoaded = true;
      console.log("Location hierarchy built with", Object.keys(locationHierarchy).length, "provinces");
      return locationHierarchy;
    } catch (error) {
      console.error("Error loading location data:", error);
      return null;
    }
  }

  function buildLocationHierarchy(jsonData) {
    const hierarchy = {};

    jsonData.forEach((item) => {
      const parts = item.name.split(" / ").map((p) => p.trim());
      if (parts.length === 3) {
        const [provincia, distrito, corregimiento] = parts;

        if (!hierarchy[provincia]) {
          hierarchy[provincia] = {};
        }
        if (!hierarchy[provincia][distrito]) {
          hierarchy[provincia][distrito] = {};
        }
        hierarchy[provincia][distrito][corregimiento] = item.code;
      }
    });

    return hierarchy;
  }

  function populateProvinceSelect(preserveValue = false) {
    const provinceSelect = document.getElementById("province");
    if (!provinceSelect) {
      console.warn("province select not found");
      return;
    }
    if (!locationHierarchy) {
      console.warn("locationHierarchy not loaded yet for province select");
      return;
    }

    // Guardar el valor actual si se debe preservar
    const currentValue = preserveValue ? provinceSelect.value : "";

    provinceSelect.innerHTML = '<option value="">Seleccione</option>';

    const provinces = Object.keys(locationHierarchy).sort();
    console.log("Populating province select with", provinces.length, "provinces:", provinces.slice(0, 5), "...");
    provinces.forEach((province) => {
      const option = document.createElement("option");
      option.value = province;
      option.textContent = province;
      provinceSelect.appendChild(option);
    });

    // Restaurar el valor si se debe preservar
    if (preserveValue && currentValue) {
      provinceSelect.value = currentValue;
    }

    updateSelectPlaceholderStyle(provinceSelect);
  }

  function populateDistrictSelect(province) {
    const districtSelect = document.getElementById("district");
    if (!districtSelect || !locationHierarchy || !province) {
      if (districtSelect) {
        districtSelect.innerHTML = '<option value="">Seleccione</option>';
        districtSelect.disabled = true;
        updateSelectPlaceholderStyle(districtSelect);
      }
      return;
    }

    districtSelect.innerHTML = '<option value="">Seleccione</option>';

    if (locationHierarchy[province]) {
      const districts = Object.keys(locationHierarchy[province]).sort();
      districts.forEach((district) => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
      });
      districtSelect.disabled = false;
    } else {
      districtSelect.disabled = true;
    }

    updateSelectPlaceholderStyle(districtSelect);
  }

  function populateCorregimientoSelect(province, district) {
    const corregimientoSelect = document.getElementById("corregimiento");
    if (!corregimientoSelect || !locationHierarchy || !province || !district) {
      if (corregimientoSelect) {
        corregimientoSelect.innerHTML = '<option value="">Seleccione</option>';
        corregimientoSelect.disabled = true;
        updateSelectPlaceholderStyle(corregimientoSelect);
      }
      return;
    }

    corregimientoSelect.innerHTML = '<option value="">Seleccione</option>';

    if (locationHierarchy[province] && locationHierarchy[province][district]) {
      const corregimientos = Object.keys(
        locationHierarchy[province][district],
      ).sort();
      corregimientos.forEach((corregimiento) => {
        const option = document.createElement("option");
        option.value = corregimiento;
        option.textContent = corregimiento;
        corregimientoSelect.appendChild(option);
      });
      corregimientoSelect.disabled = false;
    } else {
      corregimientoSelect.disabled = true;
    }

    updateSelectPlaceholderStyle(corregimientoSelect);
  }

  function getLocationCode(province, district, corregimiento) {
    if (!locationHierarchy || !province || !district || !corregimiento) {
      return null;
    }

    if (
      locationHierarchy[province] &&
      locationHierarchy[province][district] &&
      locationHierarchy[province][district][corregimiento]
    ) {
      return locationHierarchy[province][district][corregimiento];
    }

    return null;
  }

  function handleProvinceChange() {
    const provinceSelect = document.getElementById("province");
    const districtSelect = document.getElementById("district");
    const corregimientoSelect = document.getElementById("corregimiento");

    const selectedProvince = provinceSelect?.value || "";

    if (districtSelect) {
      districtSelect.value = "";
      districtSelect.disabled = !selectedProvince;
    }
    if (corregimientoSelect) {
      corregimientoSelect.value = "";
      corregimientoSelect.disabled = true;
    }

    populateDistrictSelect(selectedProvince);
    populateCorregimientoSelect("", "");
  }

  function handleDistrictChange() {
    const provinceSelect = document.getElementById("province");
    const districtSelect = document.getElementById("district");
    const corregimientoSelect = document.getElementById("corregimiento");

    const selectedProvince = provinceSelect?.value || "";
    const selectedDistrict = districtSelect?.value || "";

    if (corregimientoSelect) {
      corregimientoSelect.value = "";
      corregimientoSelect.disabled = !selectedProvince || !selectedDistrict;
    }

    populateCorregimientoSelect(selectedProvince, selectedDistrict);
  }

  function handleCorregimientoChange() {
    const provinceSelect = document.getElementById("province");
    const districtSelect = document.getElementById("district");
    const corregimientoSelect = document.getElementById("corregimiento");

    const province = provinceSelect?.value || "";
    const district = districtSelect?.value || "";
    const corregimiento = corregimientoSelect?.value || "";

    const locationCode = getLocationCode(province, district, corregimiento);

    const locationCodeInput = document.getElementById("location_code");
    if (locationCodeInput) {
      locationCodeInput.value = locationCode || "";
    }
  }

  // Funciones para manejar los selects de ubicación de Consumidor final
  function populateProvinceSelectConsumidor(preserveValue = false) {
    const provinceSelect = document.getElementById("province_consumidor");
    if (!provinceSelect) {
      console.warn("province_consumidor select not found");
      return;
    }
    if (!locationHierarchy) {
      console.warn("locationHierarchy not loaded yet");
      return;
    }

    // Guardar el valor actual si se debe preservar
    const currentValue = preserveValue ? provinceSelect.value : "";

    provinceSelect.innerHTML = '<option value="">Seleccione</option>';

    const provinces = Object.keys(locationHierarchy).sort();
    provinces.forEach((province) => {
      const option = document.createElement("option");
      option.value = province;
      option.textContent = province;
      provinceSelect.appendChild(option);
    });

    // Restaurar el valor si se debe preservar
    if (preserveValue && currentValue) {
      provinceSelect.value = currentValue;
    }

    updateSelectPlaceholderStyle(provinceSelect);
  }

  function populateDistrictSelectConsumidor(province) {
    const districtSelect = document.getElementById("district_consumidor");
    if (!districtSelect || !locationHierarchy || !province) {
      if (districtSelect) {
        districtSelect.innerHTML = '<option value="">Seleccione</option>';
        districtSelect.disabled = true;
        updateSelectPlaceholderStyle(districtSelect);
      }
      return;
    }

    districtSelect.innerHTML = '<option value="">Seleccione</option>';

    if (locationHierarchy[province]) {
      const districts = Object.keys(locationHierarchy[province]).sort();
      districts.forEach((district) => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
      });
      districtSelect.disabled = false;
    } else {
      districtSelect.disabled = true;
    }

    updateSelectPlaceholderStyle(districtSelect);
  }

  function populateCorregimientoSelectConsumidor(province, district) {
    const corregimientoSelect = document.getElementById(
      "corregimiento_consumidor",
    );
    if (!corregimientoSelect || !locationHierarchy || !province || !district) {
      if (corregimientoSelect) {
        corregimientoSelect.innerHTML = '<option value="">Seleccione</option>';
        corregimientoSelect.disabled = true;
        updateSelectPlaceholderStyle(corregimientoSelect);
      }
      return;
    }

    corregimientoSelect.innerHTML = '<option value="">Seleccione</option>';

    if (locationHierarchy[province] && locationHierarchy[province][district]) {
      const corregimientos = Object.keys(
        locationHierarchy[province][district],
      ).sort();
      corregimientos.forEach((corregimiento) => {
        const option = document.createElement("option");
        option.value = corregimiento;
        option.textContent = corregimiento;
        corregimientoSelect.appendChild(option);
      });
      corregimientoSelect.disabled = false;
    } else {
      corregimientoSelect.disabled = true;
    }

    updateSelectPlaceholderStyle(corregimientoSelect);
  }

  function handleProvinceChangeConsumidor() {
    const provinceSelect = document.getElementById("province_consumidor");
    const districtSelect = document.getElementById("district_consumidor");
    const corregimientoSelect = document.getElementById(
      "corregimiento_consumidor",
    );

    const selectedProvince = provinceSelect?.value || "";

    if (districtSelect) {
      districtSelect.value = "";
      districtSelect.disabled = !selectedProvince;
    }
    if (corregimientoSelect) {
      corregimientoSelect.value = "";
      corregimientoSelect.disabled = true;
    }

    populateDistrictSelectConsumidor(selectedProvince);
    populateCorregimientoSelectConsumidor("", "");
  }

  function handleDistrictChangeConsumidor() {
    const provinceSelect = document.getElementById("province_consumidor");
    const districtSelect = document.getElementById("district_consumidor");
    const corregimientoSelect = document.getElementById(
      "corregimiento_consumidor",
    );

    const selectedProvince = provinceSelect?.value || "";
    const selectedDistrict = districtSelect?.value || "";

    if (corregimientoSelect) {
      corregimientoSelect.value = "";
      corregimientoSelect.disabled = !selectedProvince || !selectedDistrict;
    }

    populateCorregimientoSelectConsumidor(selectedProvince, selectedDistrict);
  }

  function handleCorregimientoChangeConsumidor() {
    const provinceSelect = document.getElementById("province_consumidor");
    const districtSelect = document.getElementById("district_consumidor");
    const corregimientoSelect = document.getElementById(
      "corregimiento_consumidor",
    );

    const province = provinceSelect?.value || "";
    const district = districtSelect?.value || "";
    const corregimiento = corregimientoSelect?.value || "";

    const locationCode = getLocationCode(province, district, corregimiento);

    const locationCodeInput = document.getElementById(
      "location_code_consumidor",
    );
    if (locationCodeInput) {
      locationCodeInput.value = locationCode || "";
    }
  }

  // Funciones para manejar los selects de ubicación de Extranjero
  function populateProvinceSelectExtranjero(preserveValue = false) {
    const provinceSelect = document.getElementById("province_extranjero");
    if (!provinceSelect) {
      console.warn("province_extranjero select not found");
      return;
    }
    if (!locationHierarchy) {
      console.warn("locationHierarchy not loaded yet");
      return;
    }

    // Guardar el valor actual si se debe preservar
    const currentValue = preserveValue ? provinceSelect.value : "";

    provinceSelect.innerHTML = '<option value="">Seleccione</option>';

    const provinces = Object.keys(locationHierarchy).sort();
    provinces.forEach((province) => {
      const option = document.createElement("option");
      option.value = province;
      option.textContent = province;
      provinceSelect.appendChild(option);
    });

    // Restaurar el valor si se debe preservar
    if (preserveValue && currentValue) {
      provinceSelect.value = currentValue;
    }

    updateSelectPlaceholderStyle(provinceSelect);
  }

  function populateDistrictSelectExtranjero(province) {
    const districtSelect = document.getElementById("district_extranjero");
    if (!districtSelect || !locationHierarchy || !province) {
      if (districtSelect) {
        districtSelect.innerHTML = '<option value="">Seleccione</option>';
        districtSelect.disabled = true;
        updateSelectPlaceholderStyle(districtSelect);
      }
      return;
    }

    districtSelect.innerHTML = '<option value="">Seleccione</option>';

    if (locationHierarchy[province]) {
      const districts = Object.keys(locationHierarchy[province]).sort();
      districts.forEach((district) => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
      });
      districtSelect.disabled = false;
    } else {
      districtSelect.disabled = true;
    }

    updateSelectPlaceholderStyle(districtSelect);
  }

  function populateCorregimientoSelectExtranjero(province, district) {
    const corregimientoSelect = document.getElementById(
      "corregimiento_extranjero",
    );
    if (!corregimientoSelect || !locationHierarchy || !province || !district) {
      if (corregimientoSelect) {
        corregimientoSelect.innerHTML = '<option value="">Seleccione</option>';
        corregimientoSelect.disabled = true;
        updateSelectPlaceholderStyle(corregimientoSelect);
      }
      return;
    }

    corregimientoSelect.innerHTML = '<option value="">Seleccione</option>';

    if (locationHierarchy[province] && locationHierarchy[province][district]) {
      const corregimientos = Object.keys(
        locationHierarchy[province][district],
      ).sort();
      corregimientos.forEach((corregimiento) => {
        const option = document.createElement("option");
        option.value = corregimiento;
        option.textContent = corregimiento;
        corregimientoSelect.appendChild(option);
      });
      corregimientoSelect.disabled = false;
    } else {
      corregimientoSelect.disabled = true;
    }

    updateSelectPlaceholderStyle(corregimientoSelect);
  }

  function handleProvinceChangeExtranjero() {
    const provinceSelect = document.getElementById("province_extranjero");
    const districtSelect = document.getElementById("district_extranjero");
    const corregimientoSelect = document.getElementById(
      "corregimiento_extranjero",
    );

    const selectedProvince = provinceSelect?.value || "";

    if (districtSelect) {
      districtSelect.value = "";
      districtSelect.disabled = !selectedProvince;
    }
    if (corregimientoSelect) {
      corregimientoSelect.value = "";
      corregimientoSelect.disabled = true;
    }

    populateDistrictSelectExtranjero(selectedProvince);
    populateCorregimientoSelectExtranjero("", "");
  }

  function handleDistrictChangeExtranjero() {
    const provinceSelect = document.getElementById("province_extranjero");
    const districtSelect = document.getElementById("district_extranjero");
    const corregimientoSelect = document.getElementById(
      "corregimiento_extranjero",
    );

    const selectedProvince = provinceSelect?.value || "";
    const selectedDistrict = districtSelect?.value || "";

    if (corregimientoSelect) {
      corregimientoSelect.value = "";
      corregimientoSelect.disabled = !selectedProvince || !selectedDistrict;
    }

    populateCorregimientoSelectExtranjero(selectedProvince, selectedDistrict);
  }

  function handleCorregimientoChangeExtranjero() {
    const provinceSelect = document.getElementById("province_extranjero");
    const districtSelect = document.getElementById("district_extranjero");
    const corregimientoSelect = document.getElementById(
      "corregimiento_extranjero",
    );

    const province = provinceSelect?.value || "";
    const district = districtSelect?.value || "";
    const corregimiento = corregimientoSelect?.value || "";

    const locationCode = getLocationCode(province, district, corregimiento);

    const locationCodeInput = document.getElementById(
      "location_code_extranjero",
    );
    if (locationCodeInput) {
      locationCodeInput.value = locationCode || "";
    }
  }

  function initForm() {
    // Buscar el formulario (puede ser custom-invoice-form o register-form)
    const form = document.getElementById("custom-invoice-form") || document.getElementById("register-form");
    if (!form) {
      console.warn("Form not found in initForm(), retrying in 200ms...");
      setTimeout(initForm, 200);
      return;
    }
    console.log("Form found in initForm():", form.id);

    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");

    if (residesPanamaYes) {
      residesPanamaYes.addEventListener("change", handleCountryChange);

      if (
        !residesPanamaYes.checked &&
        (!residesPanamaNo || !residesPanamaNo.checked)
      ) {
        residesPanamaYes.checked = true;
      }
    }
    if (residesPanamaNo) {
      residesPanamaNo.addEventListener("change", handleCountryChange);
    }

    setTimeout(() => {
      handleCountryChange();
    }, 50);

    const customerType01 = document.getElementById("customer_type_01");
    const customerType02 = document.getElementById("customer_type_02");
    const customerType04 = document.getElementById("customer_type_04");
    if (customerType01) {
      customerType01.addEventListener("change", function () {
        // Limpiar error de tipo de cliente cuando se selecciona una opción
        if (
          customerType01.checked ||
          customerType02?.checked ||
          customerType04?.checked
        ) {
          clearFormError(customerType01, true);
          clearFormError(customerType02, true);
          clearFormError(customerType04, true);
          const errorElement = document.getElementById("customer_type_error");
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = customerType01.closest("label.radio-card");
          const label02 = customerType02?.closest("label.radio-card");
          const label04 = customerType04?.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
          if (label04) label04.classList.remove("error");
        }
        handleCustomerTypeChange();
      });
    }
    if (customerType02) {
      customerType02.addEventListener("change", function () {
        // Limpiar error de tipo de cliente cuando se selecciona una opción
        if (
          customerType01?.checked ||
          customerType02.checked ||
          customerType04?.checked
        ) {
          clearFormError(customerType01, true);
          clearFormError(customerType02, true);
          clearFormError(customerType04, true);
          const errorElement = document.getElementById("customer_type_error");
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = customerType01?.closest("label.radio-card");
          const label02 = customerType02.closest("label.radio-card");
          const label04 = customerType04?.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
          if (label04) label04.classList.remove("error");
        }
        handleCustomerTypeChange();
      });
    }
    if (customerType04) {
      customerType04.addEventListener("change", function () {
        // Limpiar error de tipo de cliente cuando se selecciona una opción
        if (
          customerType01?.checked ||
          customerType02?.checked ||
          customerType04.checked
        ) {
          clearFormError(customerType01, true);
          clearFormError(customerType02, true);
          clearFormError(customerType04, true);
          const errorElement = document.getElementById("customer_type_error");
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = customerType01?.closest("label.radio-card");
          const label02 = customerType02?.closest("label.radio-card");
          const label04 = customerType04.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
          if (label04) label04.classList.remove("error");
        }
        handleCustomerTypeChange();
      });
    }

    const firstNameInput = document.getElementById("first_name");
    const lastNameInput = document.getElementById("last_name");
    const taxpayerNameConsumidor = document.getElementById(
      "taxpayer_name_consumidor",
    );

    if (firstNameInput) {
      firstNameInput.addEventListener("input", function () {
        updateRazonSocial();
        updateRazonSocialExtranjero();
      });
    }
    if (lastNameInput) {
      lastNameInput.addEventListener("input", function () {
        updateRazonSocial();
        updateRazonSocialExtranjero();
      });
    }

    const birthDay = document.getElementById("birth_day");
    const birthMonth = document.getElementById("birth_month");
    const birthYear = document.getElementById("birth_year");

    if (birthDay) {
      birthDay.addEventListener("change", function () {
        updateBirthDateField();
        updateSelectPlaceholderStyle(birthDay);
      });
      updateSelectPlaceholderStyle(birthDay);
    }
    if (birthMonth) {
      birthMonth.addEventListener("change", function () {
        updateBirthDateField();
        updateSelectPlaceholderStyle(birthMonth);
      });
      updateSelectPlaceholderStyle(birthMonth);
    }
    if (birthYear) {
      birthYear.addEventListener("change", function () {
        updateBirthDateField();
        updateSelectPlaceholderStyle(birthYear);
      });
      updateSelectPlaceholderStyle(birthYear);
    }

    const allSelects = form.querySelectorAll("select.custom-invoice-input");
    allSelects.forEach((select) => {
      updateSelectPlaceholderStyle(select);
      select.addEventListener("change", function () {
        updateSelectPlaceholderStyle(select);
      });
    });

    const taxIdContribuyente = document.getElementById("tax_id_contribuyente");
    if (taxIdContribuyente) {
      taxIdContribuyente.addEventListener("input", handleTaxIdInput);
    }

    // Validación en tiempo real para cédula de consumidor final
    const taxIdConsumidor = document.getElementById("tax_id_consumidor");
    if (taxIdConsumidor) {
      taxIdConsumidor.addEventListener("input", function () {
        const taxIdValue = taxIdConsumidor.value.trim();
        if (taxIdValue && !taxIdValue.includes("-")) {
          showFormError(
            "tax_id_consumidor",
            "La cédula debe incluir guiones (ej: 8-123-4567)",
          );
          taxIdConsumidor.classList.add("error");
        } else if (taxIdValue && taxIdValue.includes("-")) {
          clearFormError(taxIdConsumidor);
        }
      });
    }

    const taxpayerKind01 = document.getElementById(
      "taxpayer_kind_contribuyente_1",
    );
    const taxpayerKind02 = document.getElementById(
      "taxpayer_kind_contribuyente_2",
    );
    if (taxpayerKind01) {
      taxpayerKind01.addEventListener("change", function () {
        // Limpiar error de tipo de contribuyente cuando se selecciona una opción
        if (taxpayerKind01.checked || taxpayerKind02?.checked) {
          clearFormError(taxpayerKind01, true);
          clearFormError(taxpayerKind02, true);
          const errorElement = document.getElementById(
            "taxpayer_kind_contribuyente_error",
          );
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = taxpayerKind01.closest("label.radio-card");
          const label02 = taxpayerKind02?.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
        }
        handleTaxpayerKindChange();
      });
    }
    if (taxpayerKind02) {
      taxpayerKind02.addEventListener("change", function () {
        // Limpiar error de tipo de contribuyente cuando se selecciona una opción
        if (taxpayerKind01?.checked || taxpayerKind02.checked) {
          clearFormError(taxpayerKind01, true);
          clearFormError(taxpayerKind02, true);
          const errorElement = document.getElementById(
            "taxpayer_kind_contribuyente_error",
          );
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = taxpayerKind01?.closest("label.radio-card");
          const label02 = taxpayerKind02.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
        }
        handleTaxpayerKindChange();
      });
    }

    // Agregar listeners para tipo de contribuyente de consumidor final
    const taxpayerKindConsumidor1 = document.getElementById(
      "taxpayer_kind_consumidor_1",
    );
    const taxpayerKindConsumidor2 = document.getElementById(
      "taxpayer_kind_consumidor_2",
    );
    if (taxpayerKindConsumidor1) {
      taxpayerKindConsumidor1.addEventListener("change", function () {
        // Limpiar error de tipo de contribuyente cuando se selecciona una opción
        if (
          taxpayerKindConsumidor1.checked ||
          taxpayerKindConsumidor2?.checked
        ) {
          clearFormError(taxpayerKindConsumidor1, true);
          clearFormError(taxpayerKindConsumidor2, true);
          const errorElement = document.getElementById(
            "taxpayer_kind_consumidor_error",
          );
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = taxpayerKindConsumidor1.closest("label.radio-card");
          const label02 = taxpayerKindConsumidor2?.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
        }
      });
    }
    if (taxpayerKindConsumidor2) {
      taxpayerKindConsumidor2.addEventListener("change", function () {
        // Limpiar error de tipo de contribuyente cuando se selecciona una opción
        if (
          taxpayerKindConsumidor1?.checked ||
          taxpayerKindConsumidor2.checked
        ) {
          clearFormError(taxpayerKindConsumidor1, true);
          clearFormError(taxpayerKindConsumidor2, true);
          const errorElement = document.getElementById(
            "taxpayer_kind_consumidor_error",
          );
          if (errorElement) {
            errorElement.classList.remove("show");
            errorElement.innerHTML = "";
          }
          // Limpiar clase error de los labels
          const label01 = taxpayerKindConsumidor1?.closest("label.radio-card");
          const label02 = taxpayerKindConsumidor2.closest("label.radio-card");
          if (label01) label01.classList.remove("error");
          if (label02) label02.classList.remove("error");
        }
      });
    }

    loadLocationData().then((hierarchy) => {
      if (!hierarchy) {
        console.error("Failed to load location data");
        return;
      }
      console.log("Location data loaded, populating selects...");
      
      populateProvinceSelect();
      populateProvinceSelectConsumidor();
      populateProvinceSelectExtranjero();

      // Verificar que los selects existan antes de agregar event listeners
      const provinceSelect = document.getElementById("province");
      const districtSelect = document.getElementById("district");
      const corregimientoSelect = document.getElementById("corregimiento");

      if (provinceSelect) {
        provinceSelect.addEventListener("change", handleProvinceChange);
      }
      if (districtSelect) {
        districtSelect.addEventListener("change", handleDistrictChange);
      }
      if (corregimientoSelect) {
        corregimientoSelect.addEventListener(
          "change",
          handleCorregimientoChange,
        );
      }

      // Event listeners para campos de ubicación de Consumidor final
      const provinceSelectConsumidor = document.getElementById(
        "province_consumidor",
      );
      const districtSelectConsumidor = document.getElementById(
        "district_consumidor",
      );
      const corregimientoSelectConsumidor = document.getElementById(
        "corregimiento_consumidor",
      );

      if (provinceSelectConsumidor) {
        provinceSelectConsumidor.addEventListener(
          "change",
          handleProvinceChangeConsumidor,
        );
      }
      if (districtSelectConsumidor) {
        districtSelectConsumidor.addEventListener(
          "change",
          handleDistrictChangeConsumidor,
        );
      }
      if (corregimientoSelectConsumidor) {
        corregimientoSelectConsumidor.addEventListener(
          "change",
          handleCorregimientoChangeConsumidor,
        );
      }

      // Event listeners para campos de ubicación de Extranjero
      const provinceSelectExtranjero = document.getElementById("province_extranjero");
      const districtSelectExtranjero = document.getElementById("district_extranjero");
      const corregimientoSelectExtranjero = document.getElementById("corregimiento_extranjero");

      if (provinceSelectExtranjero) {
        provinceSelectExtranjero.addEventListener(
          "change",
          handleProvinceChangeExtranjero,
        );
      }
      if (districtSelectExtranjero) {
        districtSelectExtranjero.addEventListener(
          "change",
          handleDistrictChangeExtranjero,
        );
      }
      if (corregimientoSelectExtranjero) {
        corregimientoSelectExtranjero.addEventListener(
          "change",
          handleCorregimientoChangeExtranjero,
        );
      }
    });

    const phoneInput = document.getElementById("phone");
    if (phoneInput) {
      phoneInput.addEventListener("input", function (e) {
        const cleanValue = e.target.value.replace(/[^0-9]/g, "");

        if (e.target.value !== cleanValue) {
          e.target.value = cleanValue;
        }

        if (cleanValue.length === 8) {
          clearFormError(e.target);
        }
      });
    }

    if (form) {
      console.log("Adding submit event listener to form:", form.id);
      form.addEventListener("submit", handleSubmit);
    } else {
      console.error("Form not found, cannot add submit event listener");
    }

    const actionCancelBtn = document.getElementById("action-cancel-btn");
    if (actionCancelBtn) {
      actionCancelBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    const actionUpdateBtn = document.getElementById("action-update-btn");
    if (actionUpdateBtn) {
      actionUpdateBtn.addEventListener("click", function (e) {
        e.preventDefault();

        const form = document.getElementById("register-form");
        if (form) {
          form.requestSubmit();
        }
      });
    }

    const inputs = form.querySelectorAll("input,select");
    let formSubmitted = false;

    inputs.forEach((i) => {
      i.addEventListener("blur", () => {
        if (formSubmitted) {
          validateField(i);
        }

        if (
          i.id === "birth_day" ||
          i.id === "birth_month" ||
          i.id === "birth_year"
        ) {
          updateBirthDateField();
        }

        // Validar email después de 500ms si es un nuevo registro
        // NO validar si el formulario ya se envió exitosamente
        if (i.id === "email" && !isSuccessfullySubmitted) {
          const customerId = document.getElementById("customer_id")?.value;
          const isUpdate = !!customerId;

          if (!isUpdate) {
            const email = i.value?.trim();
            if (email && validateEmail(email)) {
              // Delay de 500ms antes de validar
              setTimeout(async () => {
                // Verificar que el formulario no se haya enviado exitosamente durante el delay
                if (isSuccessfullySubmitted) {
                  return;
                }
                // Verificar que el campo aún tiene el foco perdido y el email no cambió
                if (document.activeElement !== i) {
                  const currentEmail = i.value?.trim();
                  if (currentEmail === email) {
                    const emailExists = await checkEmailExists(email);
                    if (emailExists) {
                      showFormError(
                        "email",
                        "Este email ya está registrado. Usa otro email o inicia sesión",
                      );
                      i.classList.add("error");
                    } else {
                      clearFormError(i);
                    }
                  }
                }
              }, 500);
            }
          }
        }
      });
      i.addEventListener("input", () => {
        // Solo limpiar el error si el campo tiene un valor válido
        // Si el formulario está en modo "submitted" y el campo está vacío, mantener el error
        const form = document.getElementById("register-form");
        const isSubmitted = form && form.classList.contains("submitted");
        const hasValue = i.value && i.value.trim() !== "";

        if (hasValue || !isSubmitted) {
          clearFormError(i);
        }

        if (formSubmitted) {
          validateField(i);
        }
      });
      i.addEventListener("change", () => {
        if (
          i.id === "birth_day" ||
          i.id === "birth_month" ||
          i.id === "birth_year"
        ) {
          updateBirthDateField();
          if (formSubmitted) {
            const birthDateField = document.getElementById("birth_date");
            if (birthDateField) validateField(birthDateField);
          }
        }
      });
    });

    form.addEventListener(
      "submit",
      function () {
        formSubmitted = true;
        form.classList.add("submitted");
      },
      { once: true },
    );
  }

  function handleCountryChange() {
    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");
    const isPanama = residesPanamaYes && residesPanamaYes.checked;

    // Limpiar errores de campos de facturación al cambiar
    clearBillingErrors();

    const billingSection = document.getElementById("billing-section");
    const foreignFields = document.getElementById("foreign-billing-fields");
    const panamaFields = document.getElementById("panama-billing-fields");

    // Asegurar que el billing-section esté siempre visible
    if (billingSection) billingSection.style.display = "block";

    if (isPanama) {
      if (foreignFields) foreignFields.style.display = "none";
      if (panamaFields) panamaFields.style.display = "block";
      handleCustomerTypeChange();
    } else {
      if (foreignFields) foreignFields.style.display = "block";
      if (panamaFields) panamaFields.style.display = "none";

      // Ocultar el campo de tipo de cliente y establecer automáticamente "Extranjero" (04)
      const customerTypeForeignGroup = document.getElementById(
        "customer_type_foreign_group",
      );
      if (customerTypeForeignGroup) {
        customerTypeForeignGroup.style.display = "none";
      }

      const customerTypeForeign = document.getElementById(
        "customer_type_foreign",
      );
      if (customerTypeForeign) {
        customerTypeForeign.value = "04";
      }
    }
  }

  function clearBillingErrors() {
    // No limpiar errores si el formulario está en modo "submitted" (validación activa)
    const form = document.getElementById("register-form");
    if (form && form.classList.contains("submitted")) {
      // Si está en modo validación, no limpiar errores automáticamente
      // Solo se limpiarán cuando el usuario seleccione una opción válida
      return;
    }

    // Limpiar errores visuales de todos los campos de facturación
    // (Solo si no está en modo validación)
    const billingFieldIds = [
      // Tipo de cliente
      "customer_type_01",
      "customer_type_02",
      "customer_type_error",
      // Contribuyente
      "tax_id_contribuyente",
      "customer_dv",
      "taxpayer_name",
      "taxpayer_kind_contribuyente_1",
      "taxpayer_kind_contribuyente_2",
      "taxpayer_kind_contribuyente_error",
      // Consumidor final
      "tax_id_consumidor",
      "taxpayer_kind_consumidor_1",
      "taxpayer_kind_consumidor_2",
      "taxpayer_kind_consumidor_error",
      // Extranjero
      "tax_id_foreign",
      // Ubicación (Contribuyente)
      "province",
      "district",
      "corregimiento",
      // Ubicación (Consumidor final)
      "province_consumidor",
      "district_consumidor",
      "corregimiento_consumidor",
      // Extranjero
      "tax_id_extranjero",
      "taxpayer_name_extranjero",
      // Ubicación (Extranjero)
      "province_extranjero",
      "district_extranjero",
      "corregimiento_extranjero",
    ];

    billingFieldIds.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) {
        clearFormError(field, true); // Forzar limpieza si no está en modo validación
        // También limpiar la clase error de los labels de radio cards
        const label = field.closest("label.radio-card");
        if (label) {
          label.classList.remove("error");
        }
      }
    });

    // Limpiar errores de los elementos de error directamente
    const errorElementIds = [
      "customer_type_error",
      "taxpayer_kind_contribuyente_error",
      "taxpayer_kind_consumidor_error",
    ];

    errorElementIds.forEach((errorId) => {
      const errorElement = document.getElementById(errorId);
      if (errorElement) {
        errorElement.classList.remove("show");
        errorElement.innerHTML = "";
      }
    });
  }

  function handleCustomerTypeChange() {
    // Limpiar errores de campos de facturación al cambiar tipo de cliente
    clearBillingErrors();

    const customerType01 = document.getElementById("customer_type_01");
    const customerType02 = document.getElementById("customer_type_02");
    const customerType04 = document.getElementById("customer_type_04");
    const customerType = customerType01?.checked
      ? "01"
      : customerType02?.checked
        ? "02"
        : customerType04?.checked
          ? "04"
          : "";

    const contribuyenteFields = document.getElementById("contribuyente-fields");
    const consumidorFields = document.getElementById("consumidor-fields");
    const extranjeroFields = document.getElementById("extranjero-fields");

    // Si ex_tax_id está guardado (inmutable), mantener el mismo valor en todos los campos
    // independientemente del tipo de cliente seleccionado
    const taxIdContribuyente = document.getElementById("tax_id_contribuyente");
    const taxIdConsumidor = document.getElementById("tax_id_consumidor");
    const taxIdExtranjero = document.getElementById("tax_id_extranjero");
    const taxIdForeign = document.getElementById("tax_id_foreign");

    // Obtener el valor de ex_tax_id del primer campo que esté deshabilitado (inmutable)
    let immutableTaxId = null;
    const allTaxIdFields = [
      taxIdContribuyente,
      taxIdConsumidor,
      taxIdExtranjero,
      taxIdForeign,
    ];
    for (const field of allTaxIdFields) {
      if (field && field.disabled && field.value && field.value.trim()) {
        immutableTaxId = field.value.trim();
        break;
      }
    }

    // Si hay un valor inmutable, aplicarlo a todos los campos
    if (immutableTaxId) {
      if (taxIdContribuyente && !taxIdContribuyente.disabled) {
        taxIdContribuyente.value = immutableTaxId;
      }
      if (taxIdConsumidor && !taxIdConsumidor.disabled) {
        taxIdConsumidor.value = immutableTaxId;
      }
      if (taxIdExtranjero && !taxIdExtranjero.disabled) {
        taxIdExtranjero.value = immutableTaxId;
      }
      if (taxIdForeign && !taxIdForeign.disabled) {
        taxIdForeign.value = immutableTaxId;
      }
    }

    if (customerType === "01") {
      if (contribuyenteFields) contribuyenteFields.style.display = "block";
      if (consumidorFields) consumidorFields.style.display = "none";
      if (extranjeroFields) extranjeroFields.style.display = "none";

      const dvGroup = document
        .getElementById("customer_dv")
        ?.closest(".custom-invoice-form-group");
      const razonGroup = document
        .getElementById("taxpayer_name_contribuyente")
        ?.closest(".custom-invoice-form-group");
      const dvField = document.getElementById("customer_dv");
      const razonField = document.getElementById("taxpayer_name_contribuyente");

      if (dvGroup && dvField && (!dvField.value || !dvField.value.trim())) {
        dvGroup.style.display = "none";
      }
      if (
        razonGroup &&
        razonField &&
        (!razonField.value || !razonField.value.trim())
      ) {
        razonGroup.style.display = "none";
      }

      loadLocationData().then(() => {
        populateProvinceSelect(true);
      });
    } else if (customerType === "02") {
      if (contribuyenteFields) contribuyenteFields.style.display = "none";
      if (consumidorFields) consumidorFields.style.display = "block";
      if (extranjeroFields) extranjeroFields.style.display = "none";

      // Ocultar el campo de tipo de contribuyente y establecer automáticamente "Natural" (1)
      const taxpayerKindConsumidorGroup = document.getElementById(
        "taxpayer_kind_consumidor_group",
      );
      if (taxpayerKindConsumidorGroup) {
        taxpayerKindConsumidorGroup.style.display = "none";
      }

      // Establecer automáticamente el valor "Natural" (1)
      const taxpayerKindConsumidor1 = document.getElementById(
        "taxpayer_kind_consumidor_1",
      );
      if (taxpayerKindConsumidor1) {
        taxpayerKindConsumidor1.checked = true;
        taxpayerKindConsumidor1.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      }

      setTimeout(() => {
        updateRazonSocial();
      }, 50);

      taxpayerKindSelected = false;
      hideValidationIndicator();
      hideValidationMessage();
      if (validationTimeout) {
        clearTimeout(validationTimeout);
        validationTimeout = null;
      }

      loadLocationData().then(() => {
        populateProvinceSelect(true);
        populateProvinceSelectConsumidor(true);
      });
    } else if (customerType === "04") {
      if (contribuyenteFields) contribuyenteFields.style.display = "none";
      if (consumidorFields) consumidorFields.style.display = "none";
      if (extranjeroFields) extranjeroFields.style.display = "block";

      // Establecer automáticamente tipo de contribuyente Natural (1) y DV 00 (ya están en hidden inputs)
      const taxpayerKindExtranjero = document.getElementById(
        "taxpayer_kind_extranjero",
      );
      const customerDvExtranjero = document.getElementById(
        "customer_dv_extranjero",
      );
      if (taxpayerKindExtranjero) {
        taxpayerKindExtranjero.value = "1";
      }
      if (customerDvExtranjero) {
        customerDvExtranjero.value = "00";
      }

      setTimeout(() => {
        updateRazonSocialExtranjero();
      }, 50);

      taxpayerKindSelected = false;
      hideValidationIndicator();
      hideValidationMessage();
      if (validationTimeout) {
        clearTimeout(validationTimeout);
        validationTimeout = null;
      }

      loadLocationData().then(() => {
        populateProvinceSelect(true);
        populateProvinceSelectExtranjero(true);
      });
    } else {
      if (contribuyenteFields) contribuyenteFields.style.display = "none";
      if (consumidorFields) consumidorFields.style.display = "none";
      if (extranjeroFields) extranjeroFields.style.display = "none";

      // Ocultar también el campo de tipo de contribuyente de consumidor
      const taxpayerKindConsumidorGroup = document.getElementById(
        "taxpayer_kind_consumidor_group",
      );
      if (taxpayerKindConsumidorGroup) {
        taxpayerKindConsumidorGroup.style.display = "none";
      }

      taxpayerKindSelected = false;
      hideValidationIndicator();
      hideValidationMessage();
      if (validationTimeout) {
        clearTimeout(validationTimeout);
        validationTimeout = null;
      }

      loadLocationData().then(() => {
        populateProvinceSelect(true);
      });
    }
  }

  function updateRazonSocial() {
    const customerType02 = document.getElementById("customer_type_02");
    if (!customerType02 || !customerType02.checked) return;

    const firstName = document.getElementById("first_name")?.value || "";
    const lastName = document.getElementById("last_name")?.value || "";
    const taxpayerNameConsumidor = document.getElementById(
      "taxpayer_name_consumidor",
    );

    if (taxpayerNameConsumidor) {
      const razonSocial = `${firstName} ${lastName}`.trim().toUpperCase();

      taxpayerNameConsumidor.value = razonSocial;
    }
  }

  function updateRazonSocialExtranjero() {
    const customerType04 = document.getElementById("customer_type_04");
    if (!customerType04 || !customerType04.checked) return;

    const firstName = document.getElementById("first_name")?.value || "";
    const lastName = document.getElementById("last_name")?.value || "";
    const taxpayerNameExtranjero = document.getElementById(
      "taxpayer_name_extranjero",
    );

    if (taxpayerNameExtranjero) {
      const razonSocial = `${firstName} ${lastName}`.trim().toUpperCase();

      taxpayerNameExtranjero.value = razonSocial;
    }
  }

  let validationTimeout = null;
  let isValidating = false;
  let taxpayerKindSelected = false;
  let contribuyenteValidationSuccess = false; // Rastrear si la validación de la API fue exitosa
  let currentValidationToken = 0;

  function showValidationLoader() {
    const indicator = document.getElementById(
      "tax_id_contribuyente_validation",
    );
    if (indicator) {
      indicator.innerHTML = '<span class="validation-loader"></span>';
      indicator.classList.add("active");
    }
  }

  function showValidationIcon(success) {
    const indicator = document.getElementById(
      "tax_id_contribuyente_validation",
    );
    if (indicator) {
      if (success) {
        indicator.innerHTML =
          '<span class="validation-check"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>';
      } else {
        indicator.innerHTML =
          '<span class="validation-error"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>';
      }
      indicator.classList.add("active");
    }
  }

  function showValidationIconIfValid() {
    const taxIdInput = document.getElementById("tax_id_contribuyente");
    const dvField = document.getElementById("customer_dv");
    const razonSocialField = document.getElementById(
      "taxpayer_name_contribuyente",
    );

    if (taxIdInput && dvField && razonSocialField) {
      const hasRuc = taxIdInput.value.trim() !== "";
      const hasDv = dvField.value.trim() !== "";
      const hasRazon = razonSocialField.value.trim() !== "";

      if (hasRuc && hasDv && hasRazon) {
        showValidationIcon(true);
      }
    }
  }

  function hideValidationIndicator() {
    const indicator = document.getElementById(
      "tax_id_contribuyente_validation",
    );
    if (indicator) {
      indicator.innerHTML = "";
      indicator.classList.remove("active");
    }
  }

  function showValidationMessage(message, isError) {
    const messageEl = document.getElementById(
      "contribuyente-validation-message",
    );
    if (messageEl) {
      messageEl.innerHTML = `<span>${message}</span>`;
      messageEl.className = `validation-message ${isError ? "error" : "success"}`;
      messageEl.style.display = "flex";
    }
  }

  function hideValidationMessage() {
    const messageEl = document.getElementById(
      "contribuyente-validation-message",
    );
    if (messageEl) {
      messageEl.style.display = "none";
      messageEl.innerHTML = "";
      messageEl.className = "validation-message";
    }
  }

  function populateContribuyenteFields(dv, razonSocial) {
    const dvField = document.getElementById("customer_dv");
    const razonSocialField = document.getElementById(
      "taxpayer_name_contribuyente",
    );
    const dvGroup = dvField?.closest(".custom-invoice-form-group");
    const razonGroup = razonSocialField?.closest(".custom-invoice-form-group");

    if (dvField) {
      dvField.value = dv || "";
      if (dv && dv.trim()) {
        if (dvGroup) dvGroup.style.display = "flex";
        // Limpiar error si el campo tiene valor (autocompletado)
        clearFormError(dvField, true);
      } else {
        if (dvGroup) dvGroup.style.display = "none";
      }
    }
    if (razonSocialField) {
      razonSocialField.value = razonSocial || "";
      if (razonSocial && razonSocial.trim()) {
        if (razonGroup) razonGroup.style.display = "flex";
        // Limpiar error si el campo tiene valor (autocompletado)
        clearFormError(razonSocialField, true);
      } else {
        if (razonGroup) razonGroup.style.display = "none";
      }
    }
  }

  function clearContribuyenteFields() {
    populateContribuyenteFields("", "");
    contribuyenteValidationSuccess = false; // Resetear validación al limpiar campos
    const dvGroup = document
      .getElementById("customer_dv")
      ?.closest(".custom-invoice-form-group");
    const razonGroup = document
      .getElementById("taxpayer_name_contribuyente")
      ?.closest(".custom-invoice-form-group");
    if (dvGroup) dvGroup.style.display = "none";
    if (razonGroup) razonGroup.style.display = "none";
  }

  async function validateContribuyente(ruc, tipoRuc) {
    if (!ruc || !ruc.trim()) {
      return;
    }

    if (!tipoRuc || (tipoRuc !== "1" && tipoRuc !== "2")) {
      return;
    }

    currentValidationToken++;
    const validationToken = currentValidationToken;

    if (isValidating) {
      isValidating = false;
    }

    isValidating = true;
    contribuyenteValidationSuccess = false; // Resetear validación al iniciar nueva validación
    showValidationLoader();
    hideValidationMessage();
    clearContribuyenteFields();

    try {
      const response = await fetch(
        "/apps/custom-invoice/contribuyente/validate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dRuc: ruc.trim(),
            dTipoRuc: tipoRuc,
          }),
        },
      );

      if (validationToken !== currentValidationToken) {
        return;
      }

      const data = await response.json();

      if (validationToken !== currentValidationToken) {
        return;
      }

      if (data.success && data.data) {
        contribuyenteValidationSuccess = true; // Marcar validación como exitosa
        showValidationIcon(true);
        populateContribuyenteFields(data.data.dDV, data.data.dNomb);
        showValidationMessage(
          "Sus datos de contribuyente han sido validados correctamente.",
          false,
        );

        const dvGroup = document
          .getElementById("customer_dv")
          ?.closest(".custom-invoice-form-group");
        const razonGroup = document
          .getElementById("taxpayer_name_contribuyente")
          ?.closest(".custom-invoice-form-group");
        if (dvGroup && data.data.dDV) dvGroup.style.display = "flex";
        if (razonGroup && data.data.dNomb) razonGroup.style.display = "flex";

        // Asegurar que los errores se limpien después de autocompletar
        setTimeout(() => {
          const dvField = document.getElementById("customer_dv");
          const razonField = document.getElementById(
            "taxpayer_name_contribuyente",
          );
          if (dvField && dvField.value && dvField.value.trim() !== "") {
            clearFormError(dvField, true);
          }
          if (
            razonField &&
            razonField.value &&
            razonField.value.trim() !== ""
          ) {
            clearFormError(razonField, true);
          }
        }, 100);
      } else {
        contribuyenteValidationSuccess = false; // Marcar validación como fallida
        showValidationIcon(false);
        clearContribuyenteFields();

        // Validar si la cédula tiene guiones cuando la API devuelve un error
        const taxIdInput = document.getElementById("tax_id_contribuyente");
        if (taxIdInput && taxIdInput.value && taxIdInput.value.trim()) {
          const taxIdValue = taxIdInput.value.trim();
          if (!taxIdValue.includes("-")) {
            showFormError(
              "tax_id_contribuyente",
              "La cédula o RUC debe incluir guiones (ej: 8-123-4567)",
            );
            taxIdInput.classList.add("error");
          }
        }

        const errorMsg =
          data.error ||
          "No se pudo validar el contribuyente. Verifique que la cédula/RUC y el tipo sean correctos.";
        showValidationMessage(errorMsg, true);
      }
    } catch (error) {
      if (validationToken !== currentValidationToken) {
        return;
      }

      contribuyenteValidationSuccess = false; // Marcar validación como fallida
      showValidationIcon(false);
      clearContribuyenteFields();
      showValidationMessage(
        "No se pudo conectar con el servicio de validación. Por favor, intente nuevamente más tarde.",
        true,
      );
    } finally {
      if (validationToken === currentValidationToken) {
        isValidating = false;
      }
    }
  }

  function handleTaxIdInput() {
    if (validationTimeout) {
      clearTimeout(validationTimeout);
      validationTimeout = null;
    }

    currentValidationToken++;
    isValidating = false;
    contribuyenteValidationSuccess = false; // Resetear validación al cambiar el RUC

    hideValidationIndicator();
    hideValidationMessage();

    const taxIdInput = document.getElementById("tax_id_contribuyente");

    // Validar que tenga al menos un guión
    if (taxIdInput && taxIdInput.value && taxIdInput.value.trim()) {
      const taxIdValue = taxIdInput.value.trim();
      if (!taxIdValue.includes("-")) {
        showFormError(
          "tax_id_contribuyente",
          "La cédula o RUC debe incluir guiones (ej: 8-123-4567)",
        );
        taxIdInput.classList.add("error");
      } else {
        clearFormError(taxIdInput);
      }
    }

    if (!taxpayerKindSelected) {
      clearContribuyenteFields();
      return;
    }
    const taxpayerKind01 = document.getElementById(
      "taxpayer_kind_contribuyente_1",
    );
    const taxpayerKind02 = document.getElementById(
      "taxpayer_kind_contribuyente_2",
    );

    const ruc = taxIdInput?.value?.trim() || "";
    const tipoRuc = taxpayerKind01?.checked
      ? "1"
      : taxpayerKind02?.checked
        ? "2"
        : "";

    if (!ruc || !tipoRuc) {
      clearContribuyenteFields();
      return;
    }

    validationTimeout = setTimeout(() => {
      const currentRuc =
        document.getElementById("tax_id_contribuyente")?.value?.trim() || "";
      const currentTipoRuc = taxpayerKind01?.checked
        ? "1"
        : taxpayerKind02?.checked
          ? "2"
          : "";

      if (currentRuc === ruc && currentTipoRuc === tipoRuc) {
        validateContribuyente(ruc, tipoRuc);
      }
      validationTimeout = null;
    }, 1000);
  }

  function handleTaxpayerKindChange() {
    const taxpayerKind01 = document.getElementById(
      "taxpayer_kind_contribuyente_1",
    );
    const taxpayerKind02 = document.getElementById(
      "taxpayer_kind_contribuyente_2",
    );
    const isSelected = taxpayerKind01?.checked || taxpayerKind02?.checked;

    taxpayerKindSelected = isSelected;

    if (validationTimeout) {
      clearTimeout(validationTimeout);
      validationTimeout = null;
    }

    currentValidationToken++;
    isValidating = false;
    contribuyenteValidationSuccess = false; // Resetear validación al cambiar tipo de contribuyente

    if (!isSelected) {
      hideValidationIndicator();
      hideValidationMessage();
      clearContribuyenteFields();
      return;
    }

    hideValidationIndicator();
    hideValidationMessage();
    clearContribuyenteFields();

    const taxIdInput = document.getElementById("tax_id_contribuyente");
    const ruc = taxIdInput?.value?.trim() || "";
    const tipoRuc = taxpayerKind01?.checked ? "1" : "2";

    if (ruc) {
      validateContribuyente(ruc, tipoRuc);
    }
  }

  function validateEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function validateName(n) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(n) && n.trim().length >= 1;
  }

  function validateField(f) {
    const id = f.id;
    const v = f.value.trim();
    if (f.required && !v) {
      showFormError(id, "Requerido");
      return false;
    }
    switch (id) {
      case "email":
        if (v && !validateEmail(v)) {
          showFormError(id, "Email inválido");
          return false;
        }
        break;
      case "first_name":
      case "last_name":
        if (v && !validateName(v)) {
          showFormError(id, "Solo letras");
          return false;
        }
        break;
      case "phone":
        if (!v && f.required) {
          return false;
        }

        if (v) {
          const cleanValue = v.replace(/[\s\-\(\)]/g, "");

          const isNumeric = /^[0-9]+$/.test(cleanValue);

          if (!isNumeric) {
            showFormError(id, "Solo números");
            return false;
          }

          if (v !== cleanValue) {
            f.value = cleanValue;
          }

          if (cleanValue.length !== 8) {
            showFormError(id, "El celular debe tener exactamente 8 dígitos");
            return false;
          }

          clearFormError(f);
        }
        break;
      case "gender":
        if (v && !["M", "F", "X"].includes(v)) {
          showFormError(id, "Valor inválido");
          return false;
        }
        break;
      case "birth_date":
        if (v) {
          const date = new Date(v);
          const today = new Date();
          if (isNaN(date.getTime())) {
            showFormError(id, "Fecha inválida");
            return false;
          }
          if (date > today) {
            showFormError(id, "La fecha de nacimiento no puede ser futura");
            return false;
          }
        }
        break;
      case "resides_panama_yes":
      case "resides_panama_no":
        break;
      case "customer_type":
        if (v && !["01", "02"].includes(v)) {
          showFormError(id, "Valor inválido");
          return false;
        }
        break;
      case "taxpayer_kind_contribuyente":
      case "taxpayer_kind_consumidor":
        if (v && !["1", "2"].includes(v)) {
          showFormError(id, "Valor inválido");
          return false;
        }
        break;
    }
    clearFormError(f);
    return true;
  }

  function validateForm() {
    // Buscar el formulario (puede ser custom-invoice-form o register-form)
    const form = document.getElementById("custom-invoice-form") || document.getElementById("register-form");
    if (!form) return false;

    form.classList.add("submitted");

    // No limpiar todos los errores al inicio de la validación
    // Solo se limpiarán si los campos tienen valores válidos durante la validación

    let valid = true;
    const errorFields = [];

    const basicFields = ["first_name", "last_name", "email", "gender", "phone"];
    basicFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && field.required) {
        {
          if (!validateField(field)) {
            valid = false;
            errorFields.push(field);
          }
        }
      }
    });

    const birthDay = document.getElementById("birth_day");
    const birthMonth = document.getElementById("birth_month");
    const birthYear = document.getElementById("birth_year");

    const birthDateMissing =
      (birthDay && birthDay.required && !birthDay.value) ||
      (birthMonth && birthMonth.required && !birthMonth.value) ||
      (birthYear && birthYear.required && !birthYear.value);

    if (birthDateMissing) {
      showFormError("birth_date", getFieldErrorMessage("birth_date"));
      valid = false;
      // Agregar clase error a los selects individuales para indicar visualmente que hay un error
      if (birthDay && birthDay.required && !birthDay.value) {
        birthDay.classList.add("error");
        errorFields.push(birthDay);
      }
      if (birthMonth && birthMonth.required && !birthMonth.value) {
        birthMonth.classList.add("error");
        if (!errorFields.includes(birthMonth)) errorFields.push(birthMonth);
      }
      if (birthYear && birthYear.required && !birthYear.value) {
        birthYear.classList.add("error");
        if (!errorFields.includes(birthYear)) errorFields.push(birthYear);
      }
    }

    if (
      birthDay &&
      birthMonth &&
      birthYear &&
      birthDay.value &&
      birthMonth.value &&
      birthYear.value
    ) {
      updateBirthDateField();
      const birthDateField = document.getElementById("birth_date");
      if (birthDateField && birthDateField.value) {
        const date = new Date(birthDateField.value);
        const today = new Date();
        if (isNaN(date.getTime())) {
          showFormError("birth_date", "Fecha inválida");
          valid = false;
        } else if (date > today) {
          showFormError(
            "birth_date",
            "La fecha de nacimiento no puede ser futura",
          );
          valid = false;
        } else {
          clearFormError(birthDateField);
        }
      }
    }

    // Validar siempre los campos de facturación (ya no depende del toggle)

    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");
    const isPanama = residesPanamaYes && residesPanamaYes.checked;
    const isForeign = residesPanamaNo && residesPanamaNo.checked;

    if (!isPanama && !isForeign) {
      showFormError("country_error", getFieldErrorMessage("country_error"));
      valid = false;
      if (residesPanamaYes) {
        residesPanamaYes.classList.add("error");
        errorFields.push(residesPanamaYes);
      }
    } else {
      clearFormError(residesPanamaYes);
      clearFormError(residesPanamaNo);
    }

    if (isForeign) {
      const taxIdForeign = document.getElementById("tax_id_foreign");
      if (taxIdForeign && !taxIdForeign.value.trim()) {
        showFormError("tax_id_foreign", getFieldErrorMessage("tax_id_foreign"));
        valid = false;
        errorFields.push(taxIdForeign);
      }
    } else if (isPanama) {
      const customerType01 = document.getElementById("customer_type_01");
      const customerType02 = document.getElementById("customer_type_02");
      const customerType04 = document.getElementById("customer_type_04");
      const customerType = customerType01?.checked
        ? "01"
        : customerType02?.checked
          ? "02"
          : customerType04?.checked
            ? "04"
            : "";

      if (!customerType) {
        showFormError(
          "customer_type_error",
          getFieldErrorMessage("customer_type_error"),
        );
        valid = false;
        if (customerType01) {
          customerType01.classList.add("error");
          errorFields.push(customerType01);
        }
        if (customerType02) {
          customerType02.classList.add("error");
          errorFields.push(customerType02);
        }
        if (customerType04) {
          customerType04.classList.add("error");
          errorFields.push(customerType04);
        }
      } else {
        clearFormError(customerType01);
        clearFormError(customerType02);
        clearFormError(customerType04);
      }

      if (customerType === "01") {
        // Verificar que la validación de la API fue exitosa
        const taxIdContribuyente = document.getElementById(
          "tax_id_contribuyente",
        );

        // Validar que el campo tax_id_contribuyente no esté vacío
        if (
          !taxIdContribuyente ||
          !taxIdContribuyente.value ||
          !taxIdContribuyente.value.trim()
        ) {
          showFormError(
            "tax_id_contribuyente",
            getFieldErrorMessage("tax_id_contribuyente"),
          );
          valid = false;
          if (taxIdContribuyente) errorFields.push(taxIdContribuyente);
        } else {
          // Validar que tenga al menos un guión
          const taxIdValue = taxIdContribuyente.value.trim();
          if (!taxIdValue.includes("-")) {
            showFormError(
              "tax_id_contribuyente",
              "La cédula o RUC debe incluir guiones (ej: 8-123-4567)",
            );
            valid = false;
            errorFields.push(taxIdContribuyente);
          } else if (taxIdValue && taxIdValue !== "") {
            // Si hay un RUC/Cédula ingresado, debe haber sido validado exitosamente
            // PERO solo si el campo NO está deshabilitado (inmutable)
            // Si está deshabilitado, significa que ya fue validado previamente
            const isImmutable = taxIdContribuyente.disabled;
            if (!isImmutable && !contribuyenteValidationSuccess) {
              showFormError(
                "tax_id_contribuyente",
                "Debe validar los datos del contribuyente antes de continuar",
              );
              valid = false;
              errorFields.push(taxIdContribuyente);

              // Mostrar mensaje de validación si existe
              const validationMessage = document.getElementById(
                "contribuyente-validation-message",
              );
              if (validationMessage) {
                validationMessage.style.display = "flex";
              }
            }
          }
        }

        const taxpayerNameContribuyente = document.getElementById(
          "taxpayer_name_contribuyente",
        );
        if (
          !taxpayerNameContribuyente ||
          !taxpayerNameContribuyente.value ||
          !taxpayerNameContribuyente.value.trim()
        ) {
          showFormError(
            "taxpayer_name_contribuyente",
            getFieldErrorMessage("taxpayer_name_contribuyente"),
          );
          valid = false;
          if (taxpayerNameContribuyente)
            errorFields.push(taxpayerNameContribuyente);
        }

        // customer_dv solo se valida si existe y tiene valor (puede estar oculto si no hay RUC)
        const customerDv = document.getElementById("customer_dv");
        const dvGroup = customerDv?.closest(".custom-invoice-form-group");
        if (customerDv && dvGroup && dvGroup.style.display !== "none") {
          if (!customerDv.value || !customerDv.value.trim()) {
            showFormError("customer_dv", getFieldErrorMessage("customer_dv"));
            valid = false;
            errorFields.push(customerDv);
          }
        }

        const taxpayerKind01 = document.getElementById(
          "taxpayer_kind_contribuyente_1",
        );
        const taxpayerKind02 = document.getElementById(
          "taxpayer_kind_contribuyente_2",
        );
        const taxpayerKind = taxpayerKind01?.checked
          ? "1"
          : taxpayerKind02?.checked
            ? "2"
            : "";
        if (!taxpayerKind) {
          showFormError(
            "taxpayer_kind_contribuyente_error",
            getFieldErrorMessage("taxpayer_kind_contribuyente_error"),
          );
          valid = false;
          if (taxpayerKind01) errorFields.push(taxpayerKind01);
        }
      } else if (customerType === "02") {
        // Validar campos de consumidor final (todos son obligatorios)
        const taxIdConsumidor = document.getElementById("tax_id_consumidor");
        if (
          !taxIdConsumidor ||
          !taxIdConsumidor.value ||
          !taxIdConsumidor.value.trim()
        ) {
          showFormError(
            "tax_id_consumidor",
            getFieldErrorMessage("tax_id_consumidor"),
          );
          valid = false;
          if (taxIdConsumidor) errorFields.push(taxIdConsumidor);
        } else {
          // Validar que tenga al menos un guión
          const taxIdValue = taxIdConsumidor.value.trim();
          if (!taxIdValue.includes("-")) {
            showFormError(
              "tax_id_consumidor",
              "La cédula debe incluir guiones (ej: 8-123-4567)",
            );
            valid = false;
            if (taxIdConsumidor) errorFields.push(taxIdConsumidor);
          }
        }

        const taxpayerNameConsumidor = document.getElementById(
          "taxpayer_name_consumidor",
        );
        if (
          !taxpayerNameConsumidor ||
          !taxpayerNameConsumidor.value ||
          !taxpayerNameConsumidor.value.trim()
        ) {
          showFormError(
            "taxpayer_name_consumidor",
            getFieldErrorMessage("taxpayer_name_consumidor"),
          );
          valid = false;
          if (taxpayerNameConsumidor) errorFields.push(taxpayerNameConsumidor);
        }

        // Para Consumidor final, el tipo de contribuyente siempre es "Natural" (1)
        // No es necesario validar porque el campo está oculto y el valor se establece automáticamente
        const taxpayerKindConsumidor1 = document.getElementById(
          "taxpayer_kind_consumidor_1",
        );
        // Asegurar que siempre esté marcado como "Natural" (1)
        if (taxpayerKindConsumidor1) {
          taxpayerKindConsumidor1.checked = true;
        }

        // Validar campos de ubicación para Consumidor final (todos son obligatorios)
        const provinceConsumidor = document.getElementById(
          "province_consumidor",
        );
        if (
          !provinceConsumidor ||
          !provinceConsumidor.value ||
          provinceConsumidor.value === ""
        ) {
          showFormError(
            "province_consumidor",
            getFieldErrorMessage("province_consumidor"),
          );
          valid = false;
          if (provinceConsumidor) errorFields.push(provinceConsumidor);
        }

        const districtConsumidor = document.getElementById(
          "district_consumidor",
        );
        if (
          !districtConsumidor ||
          !districtConsumidor.value ||
          districtConsumidor.value === ""
        ) {
          showFormError(
            "district_consumidor",
            getFieldErrorMessage("district_consumidor"),
          );
          valid = false;
          if (districtConsumidor) errorFields.push(districtConsumidor);
        }

        const corregimientoConsumidor = document.getElementById(
          "corregimiento_consumidor",
        );
        if (
          !corregimientoConsumidor ||
          !corregimientoConsumidor.value ||
          corregimientoConsumidor.value === ""
        ) {
          showFormError(
            "corregimiento_consumidor",
            getFieldErrorMessage("corregimiento_consumidor"),
          );
          valid = false;
          if (corregimientoConsumidor)
            errorFields.push(corregimientoConsumidor);
        }
      } else if (customerType === "04") {
        // Validar campos de extranjero (todos son obligatorios)
        const taxIdExtranjero = document.getElementById("tax_id_extranjero");
        if (
          !taxIdExtranjero ||
          !taxIdExtranjero.value ||
          !taxIdExtranjero.value.trim()
        ) {
          showFormError(
            "tax_id_extranjero",
            getFieldErrorMessage("tax_id_extranjero"),
          );
          valid = false;
          if (taxIdExtranjero) errorFields.push(taxIdExtranjero);
        }

        const taxpayerNameExtranjero = document.getElementById(
          "taxpayer_name_extranjero",
        );
        if (
          !taxpayerNameExtranjero ||
          !taxpayerNameExtranjero.value ||
          !taxpayerNameExtranjero.value.trim()
        ) {
          showFormError(
            "taxpayer_name_extranjero",
            getFieldErrorMessage("taxpayer_name_extranjero"),
          );
          valid = false;
          if (taxpayerNameExtranjero) errorFields.push(taxpayerNameExtranjero);
        }

        // Validar campos de ubicación para Extranjero (todos son obligatorios)
        const provinceExtranjero = document.getElementById(
          "province_extranjero",
        );
        if (
          !provinceExtranjero ||
          !provinceExtranjero.value ||
          provinceExtranjero.value === ""
        ) {
          showFormError(
            "province_extranjero",
            getFieldErrorMessage("province_extranjero"),
          );
          valid = false;
          if (provinceExtranjero) errorFields.push(provinceExtranjero);
        }

        const districtExtranjero = document.getElementById(
          "district_extranjero",
        );
        if (
          !districtExtranjero ||
          !districtExtranjero.value ||
          districtExtranjero.value === ""
        ) {
          showFormError(
            "district_extranjero",
            getFieldErrorMessage("district_extranjero"),
          );
          valid = false;
          if (districtExtranjero) errorFields.push(districtExtranjero);
        }

        const corregimientoExtranjero = document.getElementById(
          "corregimiento_extranjero",
        );
        if (
          !corregimientoExtranjero ||
          !corregimientoExtranjero.value ||
          corregimientoExtranjero.value === ""
        ) {
          showFormError(
            "corregimiento_extranjero",
            getFieldErrorMessage("corregimiento_extranjero"),
          );
          valid = false;
          if (corregimientoExtranjero)
            errorFields.push(corregimientoExtranjero);
        }
      }

      // Validar campos de ubicación para Contribuyente (01) - todos son obligatorios
      if (customerType === "01") {
        const province = document.getElementById("province");
        if (!province || !province.value || province.value === "") {
          showFormError("province", getFieldErrorMessage("province"));
          valid = false;
          if (province) errorFields.push(province);
        }

        const district = document.getElementById("district");
        if (!district || !district.value || district.value === "") {
          showFormError("district", getFieldErrorMessage("district"));
          valid = false;
          if (district) errorFields.push(district);
        }

        const corregimiento = document.getElementById("corregimiento");
        if (
          !corregimiento ||
          !corregimiento.value ||
          corregimiento.value === ""
        ) {
          showFormError("corregimiento", getFieldErrorMessage("corregimiento"));
          valid = false;
          if (corregimiento) errorFields.push(corregimiento);
        }
      }
    }

    if (!valid && errorFields.length > 0) {
      const firstError = errorFields[0];
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          firstError.focus();
        }, 300);
      }
    }

    return valid;
  }

  function clearFormError(f, forceClear = false) {
    if (!f) return;
    const id = f.id;
    const e = document.getElementById(`${id}_error`);

    // No limpiar errores si el formulario está en modo "submitted" (validación activa)
    // a menos que se fuerce la limpieza o el campo tenga un valor válido
    const form = document.getElementById("custom-invoice-form");
    if (form && form.classList.contains("submitted") && !forceClear) {
      // Si el formulario está en modo validación, solo limpiar el error del campo si tiene valor
      const hasValue =
        (f.value && f.value.trim() !== "") ||
        (f.checked !== undefined && f.checked) ||
        (f.type === "radio" && f.checked);
      if (hasValue) {
        if (f) f.classList.remove("error");
        if (e) {
          e.innerHTML = "";
          e.classList.remove("show");
          e.style.display = "";
        }
        // También limpiar la clase error de los labels de radio cards
        const label = f.closest("label.radio-card");
        if (label) {
          label.classList.remove("error");
        }
      }
      return;
    }

    // Limpiar errores normalmente si no está en modo validación o si se fuerza
    if (f) f.classList.remove("error");
    if (e) {
      e.innerHTML = "";
      e.classList.remove("show");
      e.style.display = "";
    }
    // También limpiar la clase error de los labels de radio cards
    const label = f.closest("label.radio-card");
    if (label) {
      label.classList.remove("error");
    }
  }

  function showFormMsg(m, t) {
    const d = document.getElementById("form-message");
    if (d) {
      d.innerHTML = m.replace(/\n/g, "<br>");
      d.className = `custom-invoice-message ${t}`;

      d.style.setProperty("visibility", "visible", "important");
      d.style.setProperty("opacity", "1", "important");
      // Mantener el layout en flex para que el ícono quede en línea con el texto
      d.style.setProperty("display", "flex", "important");

      const actionContainer = document.querySelector(".action-container");
      if (actionContainer) {
        actionContainer.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
      setTimeout(() => {
        d.style.setProperty("opacity", "0", "important");
        setTimeout(() => {
          d.style.setProperty("visibility", "hidden", "important");
          d.style.setProperty("display", "none", "important");
          d.innerHTML = "";
        }, 300);
      }, 5000);
    }
  }

  function updateBirthDateField() {
    const day = document.getElementById("birth_day")?.value || "";
    const month = document.getElementById("birth_month")?.value || "";
    const year = document.getElementById("birth_year")?.value || "";
    const birthDateField = document.getElementById("birth_date");
    const birthDay = document.getElementById("birth_day");
    const birthMonth = document.getElementById("birth_month");
    const birthYear = document.getElementById("birth_year");

    if (day && month && year && birthDateField) {
      const formattedDate = `${year}-${month}-${day.padStart(2, "0")}`;
      birthDateField.value = formattedDate;

      // Limpiar errores cuando todos los campos estén completos
      if (birthDay) birthDay.classList.remove("error");
      if (birthMonth) birthMonth.classList.remove("error");
      if (birthYear) birthYear.classList.remove("error");
      clearFormError(birthDateField);
    } else if (birthDateField) {
      birthDateField.value = "";
    }
  }

  function getFormData() {
    const form = document.getElementById("custom-invoice-form") || document.getElementById("register-form");
    if (!form) {
      console.error("Form not found in getFormData()");
      return null;
    }
    console.log("Form found in getFormData():", form.id);

    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const isPanama = residesPanamaYes && residesPanamaYes.checked;

    const customerType01 = document.getElementById("customer_type_01");
    const customerType02 = document.getElementById("customer_type_02");
    const customerType04 = document.getElementById("customer_type_04");
    const customerType = customerType01?.checked
      ? "01"
      : customerType02?.checked
        ? "02"
        : customerType04?.checked
          ? "04"
          : "";

    const customerTypeForeign = document.getElementById(
      "customer_type_foreign",
    )?.value;

    updateBirthDateField();

    const segmentationSelected = Array.from(
      document.querySelectorAll('input[name="segmentation[]"]:checked'),
    ).map((el) => el.value);

    const d = {
      first_name: document.getElementById("first_name")?.value?.trim() || "",
      last_name: document.getElementById("last_name")?.value?.trim() || "",
      email: document.getElementById("email")?.value?.trim() || "",
      birth_date: document.getElementById("birth_date")?.value || "",
      gender: document.getElementById("gender")?.value || "",
      phone:
        document.getElementById("phone")?.value?.replace(/[^0-9]/g, "") || "",
      segmentation: segmentationSelected,
    };

    let finalCustomerType = "";
    let documentNumber = "";
    let documentType = "";

    if (!isPanama) {
      // Para extranjeros, el tipo de cliente siempre es "Extranjero" (04)
      // Asegurar que el select tenga el valor correcto
      const customerTypeForeignSelect = document.getElementById(
        "customer_type_foreign",
      );
      if (customerTypeForeignSelect) {
        customerTypeForeignSelect.value = "04";
      }
      finalCustomerType = "04"; // Siempre "Extranjero" para no residentes en Panamá
      documentNumber =
        document.getElementById("tax_id_foreign")?.value?.trim() || "";
      documentType = "pasaporte"; // Extranjero usa pasaporte
      d.phone_country_code = "+507"; // Default para extranjeros
    } else {
      finalCustomerType = customerType || "";
      d.customer_type = finalCustomerType;
      d.phone_country_code = "+507";

      if (finalCustomerType === "01") {
        documentNumber =
          document.getElementById("tax_id_contribuyente")?.value?.trim() || "";
        const customerDv =
          document.getElementById("customer_dv")?.value?.trim() || "";

        if (customerDv) {
          documentType = "ruc";
          d.customer_dv = customerDv;
        } else {
          documentType = "cedula";
        }
        d.taxpayer_name =
          document
            .getElementById("taxpayer_name_contribuyente")
            ?.value?.trim() || "";

        const taxpayerKindContribuyente01 = document.getElementById(
          "taxpayer_kind_contribuyente_1",
        );
        const taxpayerKindContribuyente02 = document.getElementById(
          "taxpayer_kind_contribuyente_2",
        );
        d.taxpayer_kind = taxpayerKindContribuyente01?.checked
          ? "1"
          : taxpayerKindContribuyente02?.checked
            ? "2"
            : "";
      } else if (finalCustomerType === "02") {
        documentNumber =
          document.getElementById("tax_id_consumidor")?.value?.trim() || "";
        documentType = "cedula"; // Consumidor final siempre usa cédula
        d.taxpayer_name =
          document.getElementById("taxpayer_name_consumidor")?.value?.trim() ||
          "";

        // Para Consumidor final, el tipo de contribuyente siempre es "Natural" (1)
        // Asegurar que el radio button esté marcado
        const taxpayerKindConsumidor01 = document.getElementById(
          "taxpayer_kind_consumidor_1",
        );
        if (taxpayerKindConsumidor01) {
          taxpayerKindConsumidor01.checked = true;
        }
        d.taxpayer_kind = "1"; // Siempre "Natural" para Consumidor final

        // Establecer DV como "00" para Consumidor final
        d.customer_dv = "00";

        // Campos de ubicación para Consumidor final
        d.province =
          document.getElementById("province_consumidor")?.value || "";
        d.district =
          document.getElementById("district_consumidor")?.value || "";
        d.corregimiento =
          document.getElementById("corregimiento_consumidor")?.value || "";
        d.location_code =
          document.getElementById("location_code_consumidor")?.value || "";
      } else if (finalCustomerType === "04") {
        documentNumber =
          document.getElementById("tax_id_extranjero")?.value?.trim() || "";
        documentType = "pasaporte"; // Extranjero usa pasaporte
        d.taxpayer_name =
          document.getElementById("taxpayer_name_extranjero")?.value?.trim() ||
          "";

        // Para Extranjero, el tipo de contribuyente siempre es "Natural" (1) y DV "00"
        d.taxpayer_kind = "1";
        d.customer_dv = "00";

        // Campos de ubicación para Extranjero
        d.province =
          document.getElementById("province_extranjero")?.value || "";
        d.district =
          document.getElementById("district_extranjero")?.value || "";
        d.corregimiento =
          document.getElementById("corregimiento_extranjero")?.value || "";
        d.location_code =
          document.getElementById("location_code_extranjero")?.value || "";
      }

      // Dirección solo aplica a Contribuyente (01)
      if (finalCustomerType === "01") {
        d.province = document.getElementById("province")?.value || "";
        d.district = document.getElementById("district")?.value || "";
        d.corregimiento = document.getElementById("corregimiento")?.value || "";
        d.location_code = document.getElementById("location_code")?.value || "";
      }
    }

    d.document_number = documentNumber;
    d.document_type = documentType;

    d.customer_type = finalCustomerType;

    const customerId = document.getElementById("customer_id")?.value;
    if (customerId) {
      d.customer_id = customerId;
    }

    return d;
  }

  async function checkEmailExists(email) {
    try {
      const response = await fetch(
        "/apps/custom-invoice/customers/email-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();
      return data.exists || false;
    } catch (error) {
      console.error("Error checking email:", error);
      return false; // En caso de error, permitir continuar (no bloquear)
    }
  }

  let isSubmitting = false;
  let isSuccessfullySubmitted = false;

  async function handleSubmit(e) {
    console.log("handleSubmit called");
    e.preventDefault();

    // Prevenir múltiples envíos
    if (isSubmitting || isSuccessfullySubmitted) {
      console.log("Form already submitting or already submitted, blocking", { isSubmitting, isSuccessfullySubmitted });
      // Resetear si está bloqueado por más de 5 segundos (posible error previo)
      if (isSubmitting) {
        console.warn("isSubmitting stuck at true, resetting...");
        isSubmitting = false;
      }
      return;
    }

    console.log("Starting form submission...");
    const form = document.getElementById("register-form");
    if (form) {
      form.classList.add("submitted");
    }

    isSubmitting = true;
    console.log("isSubmitting set to true");

    if (!validateForm()) {
      console.log("Form validation failed, resetting isSubmitting");
      showFormMsg("Complete todos los campos", "error");

      const firstError = form?.querySelector(".custom-invoice-input.error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.focus();
      }
      isSubmitting = false;
      console.log("isSubmitting reset to false after validation failure");
      return;
    }
    
    console.log("Form validation passed");

    // Validar que el email no esté registrado
    const emailField = document.getElementById("email");
    const email = emailField?.value?.trim();

    if (email) {
      const actionSubmitBtn = document.getElementById("action-submit-btn");
      const originalText = actionSubmitBtn ? actionSubmitBtn.textContent : "";
      if (actionSubmitBtn) {
        actionSubmitBtn.disabled = true;
        actionSubmitBtn.textContent = "Verificando...";
      }

      const emailExists = await checkEmailExists(email);

      if (actionSubmitBtn) {
        actionSubmitBtn.disabled = false;
        actionSubmitBtn.textContent = originalText || "Registrarse";
      }

      if (emailExists) {
        showFormError(
          "email",
          "Este email ya está registrado. Usa otro email o inicia sesión",
        );
        emailField.classList.add("error");
        emailField.scrollIntoView({ behavior: "smooth", block: "center" });
        emailField.focus();
        isSubmitting = false;
        return;
      }
    }

    const fd = getFormData();
    if (!fd) {
      console.error("getFormData() returned null/undefined, resetting isSubmitting");
      isSubmitting = false;
      console.log("isSubmitting reset to false after getFormData() returned null");
      return;
    }
    
    console.log("Form data retrieved successfully:", Object.keys(fd));
    const actionSubmitBtn = document.getElementById("action-submit-btn");
    const originalText = actionSubmitBtn ? actionSubmitBtn.textContent : "";
    if (actionSubmitBtn) {
      actionSubmitBtn.disabled = true;
      actionSubmitBtn.textContent = "Procesando...";
    }
    try {
      console.log("Sending registration request to:", `${API_BASE}/create`);
      const r = await fetch(`${API_BASE}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fd),
      });
      const res = await r.json();
      console.log("API response:", { status: r.status, ok: r.ok, hasError: !!res.error });
      if (!r.ok || res.error) {
        console.error("API error detected:", res.error);
        const errorHandled = handleBackendError(res.error);
        const error = new Error(res.error || "Error");
        error.handled = errorHandled;
        throw error;
      }
      
      console.log("Registration successful!");
      // Marcar como exitosamente enviado para prevenir validaciones adicionales
      isSuccessfullySubmitted = true;

      if (actionSubmitBtn) {
        actionSubmitBtn.disabled = false;
        actionSubmitBtn.textContent = originalText || "Registrarse";
      }
      showFormMsg(
        `Registro exitoso. Usa tu email para iniciar sesión`,
        "success",
      );
      setTimeout(() => {
        let loginUrl;

        if (typeof window.getLoginUrl === "function") {
          loginUrl = window.getLoginUrl();
        } else {
          const loginLink = document.getElementById("login-link");
          if (loginLink && loginLink.href) {
            loginUrl = loginLink.href;
          } else {
            loginUrl = LOGIN_URL;
          }
        }
        if (loginUrl) {
          window.location.href = loginUrl;
        }
      }, 2000);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      isSubmitting = false; // Resetear en caso de error
      console.log("isSubmitting reset to false after error");
      if (!err.handled) {
        showFormMsg(err.message || "Error al procesar la solicitud", "error");
      }
      if (actionSubmitBtn) {
        actionSubmitBtn.disabled = false;
        actionSubmitBtn.textContent = originalText;
      }
    }
  }

  function handleBackendError(errorMessage) {
    if (!errorMessage) return false;

    const form = document.getElementById("register-form");
    if (form) {
      form.classList.add("submitted");
    }

    const errorLower = errorMessage.toLowerCase();
    const errorFields = [];
    let fieldsMapped = false;

    if (errorLower.includes("nombre") || errorLower.includes("first_name")) {
      showFormError("first_name", "Nombre inválido o requerido");
      const field = document.getElementById("first_name");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (errorLower.includes("apellido") || errorLower.includes("last_name")) {
      showFormError("last_name", "Apellido inválido o requerido");
      const field = document.getElementById("last_name");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (errorLower.includes("email")) {
      showFormError("email", "Email inválido o requerido");
      const field = document.getElementById("email");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (errorLower.includes("fecha") || errorLower.includes("birth_date")) {
      showFormError("birth_date", "Fecha de nacimiento inválida o requerida");
      const birthDay = document.getElementById("birth_day");
      const birthMonth = document.getElementById("birth_month");
      const birthYear = document.getElementById("birth_year");
      if (birthDay) {
        birthDay.classList.add("error");
        errorFields.push(birthDay);
      }
      if (birthMonth) {
        birthMonth.classList.add("error");
        if (!errorFields.includes(birthMonth)) errorFields.push(birthMonth);
      }
      if (birthYear) {
        birthYear.classList.add("error");
        if (!errorFields.includes(birthYear)) errorFields.push(birthYear);
      }
      fieldsMapped = true;
    }
    if (errorLower.includes("género") || errorLower.includes("gender")) {
      showFormError("gender", "Género requerido");
      const field = document.getElementById("gender");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (errorLower.includes("celular") || errorLower.includes("phone")) {
      showFormError("phone", "Celular inválido o requerido");
      const field = document.getElementById("phone");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (
      errorLower.includes("país") ||
      errorLower.includes("country") ||
      errorLower.includes("resides")
    ) {
      showFormError("country_error", getFieldErrorMessage("country_error"));
      const residesPanamaYes = document.getElementById("resides_panama_yes");
      const residesPanamaNo = document.getElementById("resides_panama_no");
      if (residesPanamaYes) {
        residesPanamaYes.classList.add("error");
        errorFields.push(residesPanamaYes);
      }
      if (residesPanamaNo) {
        residesPanamaNo.classList.add("error");
        if (!errorFields.includes(residesPanamaNo))
          errorFields.push(residesPanamaNo);
      }
      fieldsMapped = true;
    }
    if (
      errorLower.includes("tipo de cliente") ||
      errorLower.includes("customer_type")
    ) {
      showFormError("customer_type_error", "Tipo de cliente requerido");
      const customerType01 = document.getElementById("customer_type_01");
      const customerType02 = document.getElementById("customer_type_02");
      if (customerType01) {
        customerType01.classList.add("error");
        errorFields.push(customerType01);
      }
      if (customerType02) {
        customerType02.classList.add("error");
        errorFields.push(customerType02);
      }
      fieldsMapped = true;
    }
    if (
      errorLower.includes("cédula") ||
      errorLower.includes("ruc") ||
      errorLower.includes("tax_id")
    ) {
      const residesPanamaYes = document.getElementById("resides_panama_yes");
      const isPanama = residesPanamaYes && residesPanamaYes.checked;
      if (isPanama) {
        const customerType01 = document.getElementById("customer_type_01");
        const customerType02 = document.getElementById("customer_type_02");
        const customerType = customerType01?.checked
          ? "01"
          : customerType02?.checked
            ? "02"
            : "";
        if (customerType === "01") {
          showFormError("tax_id_contribuyente", "Cédula o RUC requerido");
          const field = document.getElementById("tax_id_contribuyente");
          if (field) errorFields.push(field);
          fieldsMapped = true;
        } else if (customerType === "02") {
          showFormError("tax_id_consumidor", "Cédula requerida");
          const field = document.getElementById("tax_id_consumidor");
          if (field) errorFields.push(field);
          fieldsMapped = true;
        }
      } else {
        showFormError("tax_id_foreign", "Pasaporte o Identificación requerido");
        const field = document.getElementById("tax_id_foreign");
        if (field) errorFields.push(field);
        fieldsMapped = true;
      }
    }
    if (errorLower.includes("dv") || errorLower.includes("customer_dv")) {
      showFormError("customer_dv", "DV requerido");
      const field = document.getElementById("customer_dv");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (
      errorLower.includes("razón social") ||
      errorLower.includes("taxpayer_name")
    ) {
      const customerType01 = document.getElementById("customer_type_01");
      const customerType = customerType01?.checked ? "01" : "";
      if (customerType === "01") {
        showFormError("taxpayer_name_contribuyente", "Razón Social requerida");
        const field = document.getElementById("taxpayer_name_contribuyente");
        if (field) errorFields.push(field);
        fieldsMapped = true;
      }
    }
    if (
      errorLower.includes("tipo de contribuyente") ||
      errorLower.includes("taxpayer_kind")
    ) {
      const customerType01 = document.getElementById("customer_type_01");
      const customerType02 = document.getElementById("customer_type_02");
      const customerType = customerType01?.checked
        ? "01"
        : customerType02?.checked
          ? "02"
          : "";
      if (customerType === "01") {
        showFormError(
          "taxpayer_kind_contribuyente_error",
          "Tipo de Contribuyente requerido",
        );
        const taxpayerKind01 = document.getElementById(
          "taxpayer_kind_contribuyente_1",
        );
        const taxpayerKind02 = document.getElementById(
          "taxpayer_kind_contribuyente_2",
        );
        if (taxpayerKind01) errorFields.push(taxpayerKind01);
        if (taxpayerKind02) errorFields.push(taxpayerKind02);
        fieldsMapped = true;
      } else if (customerType === "02") {
        showFormError(
          "taxpayer_kind_consumidor_error",
          "Tipo de Contribuyente requerido",
        );
        const taxpayerKind01 = document.getElementById(
          "taxpayer_kind_consumidor_1",
        );
        const taxpayerKind02 = document.getElementById(
          "taxpayer_kind_consumidor_2",
        );
        if (taxpayerKind01) errorFields.push(taxpayerKind01);
        if (taxpayerKind02) errorFields.push(taxpayerKind02);
        fieldsMapped = true;
      }
    }
    if (errorLower.includes("provincia") || errorLower.includes("province")) {
      showFormError("province", "Provincia requerida");
      const field = document.getElementById("province");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (errorLower.includes("distrito") || errorLower.includes("district")) {
      showFormError("district", "Distrito requerido");
      const field = document.getElementById("district");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }
    if (errorLower.includes("corregimiento")) {
      showFormError("corregimiento", "Corregimiento requerido");
      const field = document.getElementById("corregimiento");
      if (field) errorFields.push(field);
      fieldsMapped = true;
    }

    if (errorFields.length > 0) {
      const firstError = errorFields.find((f) => f !== null);
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          firstError.focus();
        }, 300);
      }
      return true;
    } else if (!fieldsMapped) {
      showFormMsg(errorMessage, "error");
      return false; // Indica que no se mapearon errores
    }

    return fieldsMapped;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
