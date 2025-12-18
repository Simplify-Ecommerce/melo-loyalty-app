(function () {
  "use strict";

  // Verificar que window.config esté disponible
  if (!window.config) {
    console.error(
      "window.config no está disponible. Asegúrate de que el script de configuración se cargue antes.",
    );
    return;
  }

  const STORAGE_KEY = "customInvoicePreference";
  const API_BASE = "/apps/custom-invoice/customers";
  const CART_URL = window.config.CART_URL;
  const LOGIN_URL = window.config.LOGIN_URL;
  const CUSTOMER_ID = window.config.CUSTOMER_ID;
  const IS_LOGGED_IN = window.config.IS_LOGGED_IN;

  // Variables de elementos del DOM - se inicializarán en init()
  let toggle;
  let toggleText;
  let modal;
  let modalClose;

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
    toggle = document.getElementById("custom-invoice-toggle");
    toggleText = document.getElementById("toggle-text");
    modal = document.getElementById("custom-invoice-modal");
    modalClose = document.getElementById("modal-close");

    // Verificar que los elementos esenciales existan
    if (!toggle || !toggleText || !modal) {
      console.error(
        "Elementos esenciales del DOM no encontrados. Asegúrate de que el HTML esté cargado correctamente.",
      );
      return;
    }

    if (modal) {
      modal.close();
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const d = JSON.parse(saved);
      if (d.wantsInvoice) {
        toggle.setAttribute("aria-checked", "true");
        updateToggleText();

        if (IS_LOGGED_IN) {
          setTimeout(() => {
            loadCustomerDataOnInit();
          }, 500);
        } else {
          setTimeout(() => {
            disableCheckout();
          }, 500);
        }
      }
    }

    toggle.addEventListener("click", handleToggleChange);
    if (modalClose) {
      modalClose.addEventListener("click", closeModal);
    }
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) {
          closeModal();
        }
      });
    }

    const updateDataSummaryBtn = document.getElementById(
      "update-data-summary-btn",
    );
    if (updateDataSummaryBtn) {
      updateDataSummaryBtn.addEventListener("click", function () {
        const fd = document.getElementById("customer-form-container");
        const dd = document.getElementById("customer-data-display");
        if (fd) {
          fd.style.display = "none";
          fd.style.opacity = "0";
        }
        if (dd) {
          dd.style.display = "none";
          dd.style.opacity = "0";
        }

        openModal();

        setTimeout(() => {
          loadCustomerData();
        }, 50);
      });
    }

    const updateDataBtn = document.getElementById("update-data-btn");
    if (updateDataBtn) {
      updateDataBtn.addEventListener("click", function () {
        const dd = document.getElementById("customer-data-display");
        const fd = document.getElementById("customer-form-container");
        if (dd) {
          dd.style.display = "none";
          dd.style.opacity = "0";
        }

        loadCustomerData();
      });
    }

    interceptCheckoutSubmit();
    checkCheckoutButton();
    window.addEventListener("storage", handleStorageChange);
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
          disableCheckout();
        }
      })
      .catch((e) => {
        disableCheckout();
      });
  }

  function showCustomerDataSummary(c) {
    const summaryContainer = document.getElementById("customer-data-summary");
    const summaryContent = document.getElementById(
      "customer-data-summary-content",
    );

    if (!summaryContainer || !summaryContent) return;

    if (c && c.metafields) {
      const mf = c.metafields || {};
      const customerTypeLabel =
        mf.ex_customer_type === "01"
          ? "Contribuyente"
          : mf.ex_customer_type === "02"
            ? "Consumidor final"
            : mf.ex_customer_type === "04"
              ? "Extranjero"
              : "";

      summaryContent.innerHTML = `
        <div class="customer-data-summary-item">
          <strong>${c.firstName || ""} ${c.lastName || ""}</strong>
        </div>
        <div class="customer-data-summary-item">
          ${mf.ex_tax_id || ""} ${customerTypeLabel ? `(${customerTypeLabel})` : ""}
        </div>
        <div class="customer-data-summary-item">
          ${c.email || ""}
        </div>
      `;
      summaryContainer.style.display = "block";
    }
  }

  function handleToggleChange(e) {
    e.preventDefault();
    const currentState = toggle.getAttribute("aria-checked") === "true";
    const newState = !currentState;
    toggle.setAttribute("aria-checked", String(newState));
    updateToggleText();
    const wantsInvoice = newState;
    savePreference({ wantsInvoice });

    const summaryContainer = document.getElementById("customer-data-summary");

    if (wantsInvoice) {
      if (IS_LOGGED_IN) {
        loadCustomerDataOnInit();
      } else {
        openModal();
        disableCheckout();
      }
    } else {
      closeModal();
      if (summaryContainer) {
        summaryContainer.style.display = "none";
      }
      enableCheckout();
    }

    checkCheckoutButton();
  }

  function updateToggleText() {
    const isChecked = toggle.getAttribute("aria-checked") === "true";
    toggleText.textContent = isChecked
      ? "Sí, quiero una factura personalizada"
      : "No, no quiero una factura personalizada";
  }

  function openModal(showErrors = false) {
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

      const form = document.getElementById("custom-invoice-form");

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
          if (d.complete && d.customer) {
            enableCheckout();
            showCustomerDataSummary(d.customer);
          } else {
            disableCheckout();

            if (openModalIfIncomplete) {
              openModal(true);
              setTimeout(() => {
                loadCustomerData();
              }, 100);
            }
          }
        })
        .catch((e) => {
          disableCheckout();

          if (openModalIfIncomplete) {
            openModal(true);
            setTimeout(() => {
              loadCustomerData();
            }, 100);
          }
        });
    } else {
      disableCheckout();

      if (openModalIfIncomplete) {
        openModal(true);
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
            const form = document.getElementById("custom-invoice-form");
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
                const form = document.getElementById("custom-invoice-form");
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
                        showFormError(fieldId, "Este campo es requerido");
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
              const form = document.getElementById("custom-invoice-form");
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
          const form = document.getElementById("custom-invoice-form");
          if (form) {
            form.classList.add("submitted");
            const allFields = form.querySelectorAll(
              "input[required], select[required]",
            );
            allFields.forEach((field) => {
              if (!field.value || (field.value && field.value.trim() === "")) {
                const fieldId = field.id;
                if (fieldId) {
                  showFormError(fieldId, "Este campo es requerido");
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

  function disableCheckout() {
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
          const form = document.getElementById("custom-invoice-form");
          if (form) {
            form.classList.add("submitted");

            const allFields = form.querySelectorAll(
              "input[required], select[required]",
            );
            allFields.forEach((field) => {
              if (!field.value || (field.value && field.value.trim() === "")) {
                const fieldId = field.id;
                if (fieldId) {
                  showFormError(fieldId, "Este campo es requerido");
                }
              }
            });
          }
        }, 100);

        if (!IS_LOGGED_IN) {
        } else {
          loadCustomerData();
        }
      }
    }
  }

  function showFormError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId}_error`);

    if (field) {
      field.classList.add("error");
    }

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add("show");
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
    cb.removeAttribute("title");

    const indicator = cb.querySelector(".checkout-blocked-indicator");
    if (indicator) {
      indicator.remove();
    }

    if (cb.tagName === "A") {
      cb.style.pointerEvents = "auto";
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

      setTimeout(() => {
        animateModalHeight();
      }, 100);
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

        if (birthDay) birthDay.value = String(parseInt(day, 10));
        if (birthMonth) birthMonth.value = month;
        if (birthYear) birthYear.value = year;

        updateBirthDateField();
      }
    }
    if (genderField && mf.ex_gender) genderField.value = mf.ex_gender;
    if (phoneField && mf.ex_phone) phoneField.value = mf.ex_phone;

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
      if (taxIdForeign && mf.ex_tax_id) taxIdForeign.value = mf.ex_tax_id;
      if (customerTypeForeign) customerTypeForeign.value = "04";
    } else if (customerType === "01" || customerType === "02") {
      const customerType01 = document.getElementById("customer_type_01");
      const customerType02 = document.getElementById("customer_type_02");
      if (customerType === "01" && customerType01) {
        customerType01.checked = true;
        customerType01.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (customerType === "02" && customerType02) {
        customerType02.checked = true;
        customerType02.dispatchEvent(new Event("change", { bubbles: true }));
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

        if (taxIdContribuyente && mf.ex_tax_id)
          taxIdContribuyente.value = mf.ex_tax_id;
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
        const taxpayerKindConsumidor = document.getElementById(
          "taxpayer_kind_consumidor",
        );

        if (taxIdConsumidor && mf.ex_tax_id)
          taxIdConsumidor.value = mf.ex_tax_id;
        if (taxpayerNameConsumidor && mf.ex_taxpayer_name)
          taxpayerNameConsumidor.value = mf.ex_taxpayer_name;

        if (taxpayerKindConsumidor) {
          const taxpayerKindValue = mf.ex_taxpayer_kind || "1";
          const taxpayerKindRadio = document.getElementById(
            `taxpayer_kind_consumidor_${taxpayerKindValue}`,
          );
          if (taxpayerKindRadio) {
            taxpayerKindRadio.checked = true;
            taxpayerKindRadio.dispatchEvent(
              new Event("change", { bubbles: true }),
            );
          }
        }
      }

      if (mf.ex_customer_location_code) {
        const locationCode = mf.ex_customer_location_code;
        const locationCodeInput = document.getElementById("location_code");
        if (locationCodeInput) {
          locationCodeInput.value = locationCode;
        }

        loadLocationData().then(() => {
          if (locationHierarchy) {
            for (const provincia in locationHierarchy) {
              for (const distrito in locationHierarchy[provincia]) {
                for (const corregimiento in locationHierarchy[provincia][
                  distrito
                ]) {
                  if (
                    locationHierarchy[provincia][distrito][corregimiento] ===
                    locationCode
                  ) {
                    const provinceSelect = document.getElementById("province");
                    const districtSelect = document.getElementById("district");
                    const corregimientoSelect =
                      document.getElementById("corregimiento");

                    if (provinceSelect) {
                      provinceSelect.value = provincia;
                      populateDistrictSelect(provincia);

                      setTimeout(() => {
                        if (districtSelect) {
                          districtSelect.value = distrito;
                          populateCorregimientoSelect(provincia, distrito);

                          setTimeout(() => {
                            if (corregimientoSelect) {
                              corregimientoSelect.value = corregimiento;
                            }
                          }, 50);
                        }
                      }, 50);
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
    if (locationDataLoaded) return locationHierarchy;

    try {
      const response = await fetch(window.config.DGI_COUNTRY_CODES_URL);
      const jsonData = await response.json();
      locationHierarchy = buildLocationHierarchy(jsonData);
      locationDataLoaded = true;
      return locationHierarchy;
    } catch (error) {
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

  function populateProvinceSelect() {
    const provinceSelect = document.getElementById("province");
    if (!provinceSelect || !locationHierarchy) return;

    provinceSelect.innerHTML = '<option value="">Seleccione</option>';

    const provinces = Object.keys(locationHierarchy).sort();
    provinces.forEach((province) => {
      const option = document.createElement("option");
      option.value = province;
      option.textContent = province;
      provinceSelect.appendChild(option);
    });

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

  function initForm() {
    const form = document.getElementById("custom-invoice-form");
    if (!form) return;

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
    if (customerType01) {
      customerType01.addEventListener("change", handleCustomerTypeChange);
    }
    if (customerType02) {
      customerType02.addEventListener("change", handleCustomerTypeChange);
    }

    const firstNameInput = document.getElementById("first_name");
    const lastNameInput = document.getElementById("last_name");
    const taxpayerNameConsumidor = document.getElementById(
      "taxpayer_name_consumidor",
    );

    if (firstNameInput) {
      firstNameInput.addEventListener("input", updateRazonSocial);
    }
    if (lastNameInput) {
      lastNameInput.addEventListener("input", updateRazonSocial);
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

    const taxpayerKind01 = document.getElementById(
      "taxpayer_kind_contribuyente_1",
    );
    const taxpayerKind02 = document.getElementById(
      "taxpayer_kind_contribuyente_2",
    );
    if (taxpayerKind01) {
      taxpayerKind01.addEventListener("change", handleTaxpayerKindChange);
    }
    if (taxpayerKind02) {
      taxpayerKind02.addEventListener("change", handleTaxpayerKindChange);
    }

    loadLocationData().then(() => {
      populateProvinceSelect();

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

    if (form) form.addEventListener("submit", handleSubmit);

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

        const form = document.getElementById("custom-invoice-form");
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
      });
      i.addEventListener("input", () => {
        clearFormError(i);

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

    const billingSection = document.getElementById("billing-section");
    const foreignFields = document.getElementById("foreign-billing-fields");
    const panamaFields = document.getElementById("panama-billing-fields");

    if (!isPanama && (!residesPanamaNo || !residesPanamaNo.checked)) {
      if (billingSection) billingSection.style.display = "none";
      return;
    }

    if (billingSection) billingSection.style.display = "block";

    if (isPanama) {
      if (foreignFields) foreignFields.style.display = "none";
      if (panamaFields) panamaFields.style.display = "block";
      handleCustomerTypeChange();
    } else {
      if (foreignFields) foreignFields.style.display = "block";
      if (panamaFields) panamaFields.style.display = "none";

      const customerTypeForeign = document.getElementById(
        "customer_type_foreign",
      );
      if (customerTypeForeign) customerTypeForeign.value = "04";
    }
  }

  function handleCustomerTypeChange() {
    const customerType01 = document.getElementById("customer_type_01");
    const customerType02 = document.getElementById("customer_type_02");
    const customerType = customerType01?.checked
      ? "01"
      : customerType02?.checked
        ? "02"
        : "";

    const contribuyenteFields = document.getElementById("contribuyente-fields");
    const consumidorFields = document.getElementById("consumidor-fields");

    if (customerType === "01") {
      if (contribuyenteFields) contribuyenteFields.style.display = "block";
      if (consumidorFields) consumidorFields.style.display = "none";

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
        populateProvinceSelect();
      });
    } else if (customerType === "02") {
      if (contribuyenteFields) contribuyenteFields.style.display = "none";
      if (consumidorFields) consumidorFields.style.display = "block";
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
        populateProvinceSelect();
      });
    } else {
      if (contribuyenteFields) contribuyenteFields.style.display = "none";
      if (consumidorFields) consumidorFields.style.display = "none";

      taxpayerKindSelected = false;
      hideValidationIndicator();
      hideValidationMessage();
      if (validationTimeout) {
        clearTimeout(validationTimeout);
        validationTimeout = null;
      }

      loadLocationData().then(() => {
        populateProvinceSelect();
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

  let validationTimeout = null;
  let isValidating = false;
  let taxpayerKindSelected = false;
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
      } else {
        if (dvGroup) dvGroup.style.display = "none";
      }
    }
    if (razonSocialField) {
      razonSocialField.value = razonSocial || "";
      if (razonSocial && razonSocial.trim()) {
        if (razonGroup) razonGroup.style.display = "flex";
      } else {
        if (razonGroup) razonGroup.style.display = "none";
      }
    }
  }

  function clearContribuyenteFields() {
    populateContribuyenteFields("", "");
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
      } else {
        showValidationIcon(false);
        clearContribuyenteFields();
        const errorMsg =
          data.error ||
          "No se pudo validar el contribuyente. Verifique que la cédula/RUC y el tipo sean correctos.";
        showValidationMessage(errorMsg, true);
      }
    } catch (error) {
      if (validationToken !== currentValidationToken) {
        return;
      }

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

    hideValidationIndicator();
    hideValidationMessage();

    if (!taxpayerKindSelected) {
      clearContribuyenteFields();
      return;
    }

    const taxIdInput = document.getElementById("tax_id_contribuyente");
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
    const form = document.getElementById("custom-invoice-form");
    if (!form) return false;

    form.classList.add("submitted");

    const allFields = form.querySelectorAll(".custom-invoice-input");
    allFields.forEach((field) => {
      clearFormError(field);
    });

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

    if (birthDay && birthDay.required && !birthDay.value) {
      showFormError("birth_date", "Fecha de nacimiento requerida");
      valid = false;
      errorFields.push(birthDay);
    }
    if (birthMonth && birthMonth.required && !birthMonth.value) {
      showFormError("birth_date", "Fecha de nacimiento requerida");
      valid = false;
      if (!errorFields.includes(birthMonth)) errorFields.push(birthMonth);
    }
    if (birthYear && birthYear.required && !birthYear.value) {
      showFormError("birth_date", "Fecha de nacimiento requerida");
      valid = false;
      if (!errorFields.includes(birthYear)) errorFields.push(birthYear);
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

    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const residesPanamaNo = document.getElementById("resides_panama_no");
    const isPanama = residesPanamaYes && residesPanamaYes.checked;
    const isForeign = residesPanamaNo && residesPanamaNo.checked;

    if (!isPanama && !isForeign) {
      showFormError("country_error", "Este campo es requerido");
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
        showFormError("tax_id_foreign", "Este campo es requerido");
        valid = false;
        errorFields.push(taxIdForeign);
      }
    } else if (isPanama) {
      const customerType01 = document.getElementById("customer_type_01");
      const customerType02 = document.getElementById("customer_type_02");
      const customerType = customerType01?.checked
        ? "01"
        : customerType02?.checked
          ? "02"
          : "";

      if (!customerType) {
        showFormError("customer_type_error", "Este campo es requerido");
        valid = false;
        if (customerType01) {
          customerType01.classList.add("error");
          errorFields.push(customerType01);
        }
        if (customerType02) {
          customerType02.classList.add("error");
          errorFields.push(customerType02);
        }
      } else {
        clearFormError(customerType01);
        clearFormError(customerType02);
      }

      if (customerType === "01") {
        const contribuyenteFields = [
          "tax_id_contribuyente",
          "customer_dv",
          "taxpayer_name_contribuyente",
        ];
        contribuyenteFields.forEach((fieldId) => {
          const field = document.getElementById(fieldId);
          if (field && !validateField(field)) {
            valid = false;
            errorFields.push(field);
          }
        });

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
            "Este campo es requerido",
          );
          valid = false;
          if (taxpayerKind01) errorFields.push(taxpayerKind01);
        }
      } else if (customerType === "02") {
        const consumidorFields = ["tax_id_consumidor"];
        consumidorFields.forEach((fieldId) => {
          const field = document.getElementById(fieldId);
          if (field && !validateField(field)) {
            valid = false;
            errorFields.push(field);
          }
        });

        const taxpayerKind01 = document.getElementById(
          "taxpayer_kind_consumidor_1",
        );
        const taxpayerKind02 = document.getElementById(
          "taxpayer_kind_consumidor_2",
        );
        const taxpayerKind = taxpayerKind01?.checked
          ? "1"
          : taxpayerKind02?.checked
            ? "2"
            : "";
        if (!taxpayerKind) {
          showFormError(
            "taxpayer_kind_consumidor_error",
            "Este campo es requerido",
          );
          valid = false;
          if (taxpayerKind01) errorFields.push(taxpayerKind01);
        }
      }

      const locationFields = ["province", "district", "corregimiento"];
      locationFields.forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field && !validateField(field)) {
          valid = false;
          errorFields.push(field);
        }
      });
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

  function clearFormError(f) {
    if (!f) return;
    const id = f.id;
    const e = document.getElementById(`${id}_error`);
    if (f) f.classList.remove("error");
    if (e) {
      e.textContent = "";
      e.classList.remove("show");
    }
  }

  function showFormMsg(m, t) {
    const d = document.getElementById("form-message");
    if (d) {
      d.innerHTML = m.replace(/\n/g, "<br>");
      d.className = `custom-invoice-message ${t}`;

      d.style.setProperty("visibility", "visible", "important");
      d.style.setProperty("opacity", "1", "important");
      d.style.setProperty("display", "block", "important");

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

    if (day && month && year && birthDateField) {
      const formattedDate = `${year}-${month}-${day.padStart(2, "0")}`;
      birthDateField.value = formattedDate;
    } else if (birthDateField) {
      birthDateField.value = "";
    }
  }

  function getFormData() {
    const form = document.getElementById("custom-invoice-form");
    if (!form) return null;

    const residesPanamaYes = document.getElementById("resides_panama_yes");
    const isPanama = residesPanamaYes && residesPanamaYes.checked;

    const customerType01 = document.getElementById("customer_type_01");
    const customerType02 = document.getElementById("customer_type_02");
    const customerType = customerType01?.checked
      ? "01"
      : customerType02?.checked
        ? "02"
        : "";

    const customerTypeForeign = document.getElementById(
      "customer_type_foreign",
    )?.value;

    updateBirthDateField();

    const d = {
      first_name: document.getElementById("first_name")?.value?.trim() || "",
      last_name: document.getElementById("last_name")?.value?.trim() || "",
      email: document.getElementById("email")?.value?.trim() || "",
      birth_date: document.getElementById("birth_date")?.value || "",
      gender: document.getElementById("gender")?.value || "",
      phone:
        document.getElementById("phone")?.value?.replace(/[^0-9]/g, "") || "",
    };

    let finalCustomerType = "";
    let documentNumber = "";
    let documentType = "";

    if (!isPanama) {
      finalCustomerType = customerTypeForeign || "04";
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

        const taxpayerKindConsumidor01 = document.getElementById(
          "taxpayer_kind_consumidor_1",
        );
        const taxpayerKindConsumidor02 = document.getElementById(
          "taxpayer_kind_consumidor_2",
        );
        d.taxpayer_kind = taxpayerKindConsumidor01?.checked
          ? "1"
          : taxpayerKindConsumidor02?.checked
            ? "2"
            : "";
      }

      d.province = document.getElementById("province")?.value || "";
      d.district = document.getElementById("district")?.value || "";
      d.corregimiento = document.getElementById("corregimiento")?.value || "";
      d.location_code = document.getElementById("location_code")?.value || "";
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

  async function handleSubmit(e) {
    e.preventDefault();
    const form = document.getElementById("custom-invoice-form");
    if (form) {
      form.classList.add("submitted");
    }

    if (!validateForm()) {
      showFormMsg("Complete todos los campos", "error");

      const firstError = form?.querySelector(".custom-invoice-input.error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.focus();
      }
      return;
    }
    const fd = getFormData();
    if (!fd) return;
    const actionUpdateBtn = document.getElementById("action-update-btn");
    const originalText = actionUpdateBtn ? actionUpdateBtn.textContent : "";
    if (actionUpdateBtn) {
      actionUpdateBtn.disabled = true;
      actionUpdateBtn.textContent = "Procesando...";
    }
    const cid = document.getElementById("customer_id")?.value;
    const isUp = !!cid;
    try {
      const ep = isUp ? `${API_BASE}/update` : `${API_BASE}/create`;
      if (isUp) {
        fd.customer_id = cid;
      }
      const r = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fd),
      });
      const res = await r.json();
      if (!r.ok || res.error) {
        const errorHandled = handleBackendError(res.error);
        const error = new Error(res.error || "Error");
        error.handled = errorHandled;
        throw error;
      }
      if (isUp) {
        if (actionUpdateBtn) {
          actionUpdateBtn.disabled = false;
          actionUpdateBtn.textContent = originalText || "Actualizar";
        }
        showFormMsg("Actualizado correctamente", "success");
        setTimeout(() => {
          closeModal();
          enableCheckout();

          if (IS_LOGGED_IN) {
            loadCustomerDataOnInit();
          }
        }, 1500);
      } else {
        if (actionUpdateBtn) {
          actionUpdateBtn.disabled = false;
          actionUpdateBtn.textContent = originalText || "Registrarse";
        }
        const userEmail = fd.email;

        showFormMsg(
          `Registro exitoso. Redirigiendo al login...<br><strong>Tu email: ${userEmail}</strong><br>Úsalo para iniciar sesión.`,
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
          } else {
            closeModal();
          }
        }, 2000); // Aumentar el tiempo para que el usuario vea el email
      }
    } catch (err) {
      if (!err.handled) {
        showFormMsg(err.message || "Error al procesar la solicitud", "error");
      }
      if (actionUpdateBtn) {
        actionUpdateBtn.disabled = false;
        actionUpdateBtn.textContent = originalText;
      }
    }
  }

  function handleBackendError(errorMessage) {
    if (!errorMessage) return false;

    const form = document.getElementById("custom-invoice-form");
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
      showFormError("country_error", "Este campo es requerido");
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
