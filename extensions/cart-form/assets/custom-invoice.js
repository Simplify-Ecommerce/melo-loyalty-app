(function () {
  "use strict";
  const API_BASE = "/apps/custom-invoice/customers";
  const STORAGE_KEY = "customInvoicePreference";
  function initForm() {
    const form = document.getElementById("custom-invoice-form");
    if (!form) return;
    const dt = document.getElementById("document_type");
    const dn = document.getElementById("document_number");
    const cf = document.getElementById("cedula_fields");
    const cp = document.getElementById("cedula_province");
    const cb = document.getElementById("cedula_book");
    const ct = document.getElementById("cedula_tome");
    if (dt) {
      dt.addEventListener("change", handleDocType);
      handleDocType();
    }
    if (form) form.addEventListener("submit", handleSubmit);
    const inputs = form.querySelectorAll("input,select");
    inputs.forEach((i) => {
      i.addEventListener("blur", () => validateField(i));
      i.addEventListener("input", () => clearErr(i));
    });
    if (cp) {
      cp.addEventListener("input", validateCedula);
      cp.addEventListener("input", formatCedula);
    }
    if (cb) {
      cb.addEventListener("input", validateCedula);
      cb.addEventListener("input", formatCedula);
    }
    if (ct) {
      ct.addEventListener("input", validateCedula);
      ct.addEventListener("input", formatCedula);
    }
    if (dn) dn.addEventListener("input", validateDocNum);
  }
  function handleDocType() {
    const dt = document.getElementById("document_type")?.value;
    const dn = document.getElementById("document_number");
    const cf = document.getElementById("cedula_fields");
    const cp = document.getElementById("cedula_province");
    const cb = document.getElementById("cedula_book");
    const ct = document.getElementById("cedula_tome");
    if (dt === "cedula") {
      if (cf) cf.style.display = "block";
      if (dn) dn.style.display = "none";
      if (cp) cp.required = true;
      if (cb) cb.required = true;
      if (ct) ct.required = true;
      if (dn) dn.required = false;
    } else {
      if (cf) cf.style.display = "none";
      if (dn) dn.style.display = "block";
      if (cp) cp.required = false;
      if (cb) cb.required = false;
      if (ct) ct.required = false;
      if (dn) dn.required = true;
    }
  }
  function formatCedula(e) {
    const i = e.target;
    let v = i.value.replace(/[^0-9A-Za-z]/g, "");
    if (i.id === "cedula_province") {
      v = v.toUpperCase();
      if (v.length > 4) v = v.substring(0, 4);
    } else {
      v = v.replace(/[^0-9]/g, "");
    }
    i.value = v;
  }
  function validateCedula() {
    const p = document.getElementById("cedula_province")?.value || "";
    const b = document.getElementById("cedula_book")?.value || "";
    const t = document.getElementById("cedula_tome")?.value || "";
    const dt = document.getElementById("document_type")?.value;
    if (dt !== "cedula") return true;
    if (!p || !b || !t) return false;
    const patterns = [
      /^[0-9]{1,2}-[0-9]{1,10}-[0-9]{1,10}$/,
      /^PE-[0-9]{1,10}-[0-9]{1,10}$/,
      /^E-[0-9]{1,10}-[0-9]{1,10}$/,
      /^N-[0-9]{1,10}-[0-9]{1,10}$/,
      /^[0-9]{1,2}AV-[0-9]{1,10}-[0-9]{1,10}$/,
      /^[0-9]{1,2}PI-[0-9]{1,10}-[0-9]{1,10}$/,
    ];
    const full = `${p}-${b}-${t}`;
    const valid = patterns.some((p) => p.test(full));
    if (!valid) {
      showErr("cedula_province", "Formato inválido");
      return false;
    }
    clearErr(document.getElementById("cedula_province"));
    return true;
  }
  function validateDocNum() {
    const dt = document.getElementById("document_type")?.value;
    const dn = document.getElementById("document_number")?.value;
    if (dt !== "cedula" && dn) {
      if (dn.trim().length < 1) {
        showErr("document_number", "Requerido");
        return false;
      }
      clearErr(document.getElementById("document_number"));
    }
    return true;
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
      showErr(id, "Requerido");
      return false;
    }
    switch (id) {
      case "email":
        if (v && !validateEmail(v)) {
          showErr(id, "Email inválido");
          return false;
        }
        break;
      case "first_name":
      case "last_name":
        if (v && !validateName(v)) {
          showErr(id, "Solo letras");
          return false;
        }
        break;
      case "phone":
        if (v && !/^[0-9\-]+$/.test(v)) {
          showErr(id, "Formato inválido");
          return false;
        }
        break;
    }
    clearErr(f);
    return true;
  }
  function validateForm() {
    const form = document.getElementById("custom-invoice-form");
    if (!form) return false;
    const fields = form.querySelectorAll("input[required],select[required]");
    let valid = true;
    fields.forEach((f) => {
      if (!validateField(f)) valid = false;
    });
    const dt = document.getElementById("document_type")?.value;
    if (dt === "cedula") {
      if (!validateCedula()) valid = false;
    } else {
      if (!validateDocNum()) valid = false;
    }
    return valid;
  }
  function showErr(id, m) {
    const f = document.getElementById(id);
    const e = document.getElementById(`${id}_error`);
    if (f) f.classList.add("error");
    if (e) {
      e.textContent = m;
      e.classList.add("show");
    }
  }
  function clearErr(f) {
    if (!f) return;
    const id = f.id;
    const e = document.getElementById(`${id}_error`);
    if (f) f.classList.remove("error");
    if (e) {
      e.textContent = "";
      e.classList.remove("show");
    }
  }
  function showMsg(m, t) {
    const d = document.getElementById("form-message");
    if (d) {
      d.textContent = m;
      d.className = `custom-invoice-message ${t}`;
      d.style.display = "block";
      setTimeout(() => {
        d.style.display = "none";
      }, 5000);
    }
  }
  function getFormData() {
    const form = document.getElementById("custom-invoice-form");
    if (!form) return null;
    const fd = new FormData(form);
    const d = {};
    for (const [k, v] of fd.entries()) d[k] = v.trim();
    const dt = d.document_type;
    if (dt === "cedula") {
      const p = document.getElementById("cedula_province")?.value || "";
      const b = document.getElementById("cedula_book")?.value || "";
      const t = document.getElementById("cedula_tome")?.value || "";
      d.document_number = `${p}-${b}-${t}`;
    }
    return d;
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
      showMsg("Complete todos los campos", "error");
      return;
    }
    const fd = getFormData();
    if (!fd) return;
    const sb = document.getElementById("submit-btn");
    const originalText = sb ? sb.textContent : "";
    if (sb) {
      sb.disabled = true;
      sb.textContent = "Procesando...";
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
      if (!r.ok || res.error) throw new Error(res.error || "Error");
      if (isUp) {
        showMsg("Actualizado correctamente", "success");
        setTimeout(() => {
          closeModal();
          enableCheckout();
        }, 1500);
      } else {
        showMsg("Registro exitoso. Redirigiendo al login...", "success");
        setTimeout(() => {
          let loginUrl;
          if (typeof window.getLoginUrl === "function") {
            loginUrl = window.getLoginUrl();
          } else {
            const loginLink = document.getElementById("login-link");
            if (loginLink && loginLink.href) {
              loginUrl = loginLink.href;
            } else {
              const cartUrl = window.location.href;
              loginUrl = `/account/login?checkout_url=${encodeURIComponent(cartUrl)}`;
            }
          }
          if (loginUrl) {
            window.location.href = loginUrl;
          } else {
            console.error("No se pudo obtener la URL de login");
            closeModal();
          }
        }, 1500);
      }
    } catch (err) {
      console.error("Error:", err);
      showMsg(err.message || "Error", "error");
      if (sb) {
        sb.disabled = false;
        sb.textContent = originalText;
      }
    }
  }
  function closeModal() {
    const m = document.getElementById("custom-invoice-modal");
    if (m) m.close();
  }
  function enableCheckout() {
    const cf = document.querySelector('form[action*="checkout"]');
    if (!cf) return;
    const cb = cf.querySelector('button[type="submit"],input[type="submit"]');
    if (cb) {
      cb.disabled = false;
      cb.style.opacity = "1";
      cb.style.cursor = "pointer";
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initForm);
  } else {
    initForm();
  }
})();
