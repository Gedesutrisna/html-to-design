(() => {
  const body = document.body;
  const desktopBreakpoint = 920;
  const sidebarStates = ["normal", "compact", "hidden"];

  const getStoredSidebar = () => {
    try {
      const stored = localStorage.getItem("mekardEmployerSidebar");
      return sidebarStates.includes(stored) ? stored : "normal";
    } catch {
      return "normal";
    }
  };

  const setSidebarState = (state, announce = false) => {
    if (!sidebarStates.includes(state)) return;
    body.dataset.sidebar = state;
    try {
      localStorage.setItem("mekardEmployerSidebar", state);
    } catch {
      // Storage can be unavailable in strict/private browser contexts.
    }

    document.querySelectorAll("[data-sidebar-state]").forEach((button) => {
      const isActive = button.dataset.sidebarState === state;
      button.setAttribute("aria-pressed", String(isActive));
    });

    const labelMap = {
      normal: "Sidebar normal",
      compact: "Sidebar diperkecil",
      hidden: "Sidebar ditutup",
    };

    document.querySelectorAll("[data-sidebar-cycle]").forEach((button) => {
      button.setAttribute("aria-label", `${labelMap[state]}. Klik untuk mengganti tampilan.`);
      button.title = labelMap[state];
    });

    if (announce) showToast("Tampilan diperbarui", labelMap[state]);
  };

  const cycleSidebar = () => {
    if (window.innerWidth <= desktopBreakpoint) {
      body.classList.toggle("is-mobile-nav-open");
      return;
    }

    const current = body.dataset.sidebar || "normal";
    const next = sidebarStates[(sidebarStates.indexOf(current) + 1) % sidebarStates.length];
    setSidebarState(next, true);
  };

  setSidebarState(getStoredSidebar());

  document.querySelectorAll("[data-sidebar-cycle]").forEach((button) => {
    button.addEventListener("click", cycleSidebar);
  });

  document.querySelectorAll("[data-sidebar-state]").forEach((button) => {
    button.addEventListener("click", () => {
      setSidebarState(button.dataset.sidebarState, true);
      body.classList.remove("is-mobile-nav-open");
    });
  });

  document.querySelectorAll("[data-sidebar-close]").forEach((button) => {
    button.addEventListener("click", () => {
      if (window.innerWidth <= desktopBreakpoint) {
        body.classList.remove("is-mobile-nav-open");
      } else {
        setSidebarState(body.dataset.sidebar === "compact" ? "normal" : "compact", true);
      }
    });
  });

  document.querySelectorAll("[data-mobile-overlay]").forEach((overlay) => {
    overlay.addEventListener("click", () => body.classList.remove("is-mobile-nav-open"));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > desktopBreakpoint) body.classList.remove("is-mobile-nav-open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      body.classList.remove("is-mobile-nav-open");
      closeModal();
    }

    if (event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      cycleSidebar();
    }
  });

  // Tabs
  document.querySelectorAll("[data-tabs]").forEach((tabs) => {
    const buttons = tabs.querySelectorAll("[data-tab-target]");
    const panels = document.querySelectorAll(`[data-tab-group="${tabs.dataset.tabs}"]`);

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((item) => {
          item.classList.remove("is-active");
          item.setAttribute("aria-selected", "false");
        });
        panels.forEach((panel) => panel.classList.remove("is-active"));

        button.classList.add("is-active");
        button.setAttribute("aria-selected", "true");
        document.getElementById(button.dataset.tabTarget)?.classList.add("is-active");
      });
    });
  });

  // Character count
  document.querySelectorAll("[data-char-count]").forEach((field) => {
    const target = document.querySelector(field.dataset.charCount);
    const max = Number(field.getAttribute("maxlength")) || 0;
    const update = () => {
      if (target) target.textContent = `${field.value.length}${max ? `/${max}` : ""}`;
    };
    field.addEventListener("input", update);
    update();
  });

  // ML wage estimation prototype
  const estimatorForm = document.querySelector("[data-job-form]");
  if (estimatorForm) {
    const fields = {
      duration: estimatorForm.querySelector("[name='duration']"),
      workers: estimatorForm.querySelector("[name='workers']"),
      startTime: estimatorForm.querySelector("[name='start_time']"),
      shiftTime: estimatorForm.querySelector("[name='shift_time']"),
      additionalWage: estimatorForm.querySelector("[name='additional_wage']"),
    };

    const outputs = {
      recommended: document.querySelector("[data-estimate-recommended]"),
      range: document.querySelector("[data-estimate-range]"),
      duration: document.querySelector("[data-estimate-duration]"),
      score: document.querySelector("[data-estimate-score]"),
      adjustment: document.querySelector("[data-estimate-adjustment]"),
      shift: document.querySelector("[data-estimate-shift]"),
      additional: document.querySelector("[data-estimate-additional]"),
      multiplication: document.querySelector("[data-estimate-multiplication]"),
      total: document.querySelector("[data-estimate-total]"),
      shiftLabel: document.querySelector("[data-shift-label]"),
      shiftDescription: document.querySelector("[data-shift-description]"),
      shiftStatus: document.querySelector("[data-shift-status]"),
      recommendedHidden: estimatorForm.querySelector("[name='recommended_wage']"),
      finalHidden: estimatorForm.querySelector("[name='final_wage_per_worker']"),
      scoreHidden: estimatorForm.querySelector("[name='risk_score']"),
    };

    const idr = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });

    // Nilai ini hanya fallback prototipe. Ganti hasil calculatePrototypeWage()
    // dengan response API model Machine Learning pada implementasi produksi.
    const BASE_HOURLY_WAGE = 22000;
    const SCORE_RATE = 0.06;
    const PLATFORM_FLOOR = 60000;
    const ROUNDING_UNIT = 5000;

    const roundWage = (value) => Math.round(value / ROUNDING_UNIT) * ROUNDING_UNIT;

    const getRadioScore = (name) => {
      const selected = estimatorForm.querySelector(`[name='${name}']:checked`);
      return Math.max(0, Number(selected?.value) || 0);
    };

    const getShift = (startTime, durationHours) => {
      const [hours, minutes] = String(startTime || "08:00")
        .split(":")
        .map((part) => Number(part) || 0);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + durationHours * 60;
      const isNormal = startMinutes >= 6 * 60 && endMinutes <= 18 * 60;

      return {
        value: isNormal ? "normal" : "night",
        score: isNormal ? 0 : 2,
        label: isNormal ? "Jam normal" : "Shift malam",
        description: isNormal
          ? "Seluruh durasi berada di antara 06.00–18.00."
          : "Waktu kerja berada atau melintasi pukul 18.00–06.00.",
      };
    };

    const calculatePrototypeWage = ({ duration, objectiveScore }) => {
      const baseWage = duration * BASE_HOURLY_WAGE;
      const adjustmentRate = objectiveScore * SCORE_RATE;
      const predicted = baseWage * (1 + adjustmentRate);
      return Math.max(PLATFORM_FLOOR, roundWage(predicted));
    };

    const calculate = () => {
      const duration = Math.max(1, Number(fields.duration?.value) || 1);
      const workers = Math.max(1, Number(fields.workers?.value) || 1);
      const additionalWage = Math.max(0, Number(fields.additionalWage?.value) || 0);
      const shift = getShift(fields.startTime?.value, duration);

      const indicatorScore =
        getRadioScore("effort_level") +
        getRadioScore("weight_load") +
        getRadioScore("vertical_hazard") +
        getRadioScore("material_hazard") +
        getRadioScore("environment_space");

      const objectiveScore = indicatorScore + shift.score;
      const adjustmentRate = objectiveScore * SCORE_RATE;
      const recommendedPerWorker = calculatePrototypeWage({ duration, objectiveScore });
      const finalPerWorker = recommendedPerWorker + additionalWage;
      const totalBudget = finalPerWorker * workers;
      const low = roundWage(recommendedPerWorker * 0.9);
      const high = roundWage(recommendedPerWorker * 1.12);

      if (fields.shiftTime) fields.shiftTime.value = shift.value;

      if (outputs.recommended) outputs.recommended.textContent = idr.format(finalPerWorker);
      if (outputs.range) outputs.range.textContent = `Rentang rekomendasi sistem ${idr.format(low)} – ${idr.format(high)}`;
      if (outputs.duration) outputs.duration.textContent = `${duration} jam × ${idr.format(BASE_HOURLY_WAGE)}`;
      if (outputs.score) outputs.score.textContent = `${objectiveScore} poin`;
      if (outputs.adjustment) outputs.adjustment.textContent = `+${Math.round(adjustmentRate * 100)}%`;
      if (outputs.shift) outputs.shift.textContent = `${shift.label} (+${shift.score} poin)`;
      if (outputs.additional) outputs.additional.textContent = idr.format(additionalWage);
      if (outputs.multiplication) outputs.multiplication.textContent = `${workers} orang × ${idr.format(finalPerWorker)}`;
      if (outputs.total) outputs.total.textContent = idr.format(totalBudget);

      if (outputs.shiftLabel) outputs.shiftLabel.textContent = shift.label;
      if (outputs.shiftDescription) outputs.shiftDescription.textContent = shift.description;
      if (outputs.shiftStatus) {
        outputs.shiftStatus.classList.toggle("is-night", shift.value === "night");
        const icon = outputs.shiftStatus.querySelector(".material-symbols-rounded");
        if (icon) icon.textContent = shift.value === "night" ? "dark_mode" : "light_mode";
      }

      if (outputs.recommendedHidden) outputs.recommendedHidden.value = String(recommendedPerWorker);
      if (outputs.finalHidden) outputs.finalHidden.value = String(finalPerWorker);
      if (outputs.scoreHidden) outputs.scoreHidden.value = String(objectiveScore);
    };

    estimatorForm.addEventListener("input", calculate);
    estimatorForm.addEventListener("change", calculate);
    calculate();

    estimatorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      showToast("Lowongan siap dipublikasikan", "Upah per pekerja dan total anggaran sudah dihitung.");
    });

    estimatorForm.querySelectorAll("[data-save-draft]").forEach((button) => {
      button.addEventListener("click", () => showToast("Draft tersimpan", "Perubahan disimpan secara lokal pada prototipe."));
    });
  }



  // Job list search and status filter
  const jobRows = [...document.querySelectorAll("[data-job-row]")];
  const jobSearch = document.querySelector("[data-job-search]");
  const jobStatus = document.querySelector("[data-job-status]");
  const jobResult = document.querySelector("[data-job-result]");
  const jobEmpty = document.querySelector("[data-job-empty]");

  const filterJobs = () => {
    if (!jobRows.length) return;
    const query = (jobSearch?.value || "").trim().toLowerCase();
    const status = jobStatus?.value || "all";
    let visible = 0;

    jobRows.forEach((row) => {
      const haystack = (row.dataset.jobSearchValue || row.textContent || "").toLowerCase();
      const rowStatus = row.dataset.jobStatusValue || "";
      const show = (!query || haystack.includes(query)) && (status === "all" || rowStatus === status);
      row.hidden = !show;
      if (show) visible += 1;
    });

    if (jobResult) jobResult.textContent = `${visible} lowongan ditampilkan`;
    if (jobEmpty) jobEmpty.hidden = visible !== 0;
  };

  jobSearch?.addEventListener("input", filterJobs);
  jobStatus?.addEventListener("change", filterJobs);
  document.querySelector("[data-job-reset]")?.addEventListener("click", () => {
    if (jobSearch) jobSearch.value = "";
    if (jobStatus) jobStatus.value = "all";
    filterJobs();
  });
  filterJobs();

  // Applicant search and filters
  const applicantSearches = [...document.querySelectorAll("[data-applicant-search]")];
  const statusFilter = document.querySelector("[data-applicant-status]");
  const distanceFilter = document.querySelector("[data-applicant-distance]");
  const applicantCards = [...document.querySelectorAll("[data-applicant-card]")];
  let applicantQuery = "";

  const filterApplicants = () => {
    const query = applicantQuery.trim().toLowerCase();
    const status = statusFilter?.value || "all";
    const distance = Number(distanceFilter?.value) || Infinity;

    let visible = 0;
    applicantCards.forEach((card) => {
      const name = card.dataset.name?.toLowerCase() || "";
      const cardStatus = card.dataset.status || "new";
      const cardDistance = Number(card.dataset.distance) || 0;
      const show = (!query || name.includes(query)) && (status === "all" || status === cardStatus) && cardDistance <= distance;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const result = document.querySelector("[data-applicant-result]");
    if (result) result.textContent = `${visible} pelamar ditampilkan`;
  };

  applicantSearches.forEach((field) => {
    field.addEventListener("input", () => {
      applicantQuery = field.value;
      applicantSearches.forEach((other) => {
        if (other !== field) other.value = applicantQuery;
      });
      filterApplicants();
    });
  });
  [statusFilter, distanceFilter].forEach((field) => field?.addEventListener("change", filterApplicants));
  if (applicantCards.length) filterApplicants();

  document.querySelectorAll("[data-reset-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      applicantQuery = "";
      applicantSearches.forEach((field) => (field.value = ""));
      if (statusFilter) statusFilter.value = "all";
      if (distanceFilter) distanceFilter.value = "999";
      filterApplicants();
    });
  });

  // Modal hiring flow
  const modalBackdrop = document.querySelector("[data-modal-backdrop]");
  let selectedApplicantCard = null;

  const getQuotaState = () => {
    const quota = document.querySelector("[data-quota-value]");
    return {
      current: Number(quota?.dataset.current || 0),
      total: Number(quota?.dataset.total || 0),
    };
  };

  const updateQuotaSummary = (current, total, wagePerWorker) => {
    document.querySelectorAll("[data-selected-count]").forEach((node) => {
      node.textContent = `${current} pekerja`;
    });
    document.querySelectorAll("[data-remaining-count]").forEach((node) => {
      node.textContent = `${Math.max(0, total - current)} pekerja`;
    });
    document.querySelectorAll("[data-selected-budget]").forEach((node) => {
      node.textContent = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(current * wagePerWorker);
    });
  };

  function openModal(card) {
    if (!modalBackdrop || !card) return;
    const quota = getQuotaState();
    if (quota.total > 0 && quota.current >= quota.total) {
      showToast("Kebutuhan sudah terpenuhi", "Tidak dapat memilih pekerja tambahan sebelum kuota diubah.");
      return;
    }
    selectedApplicantCard = card;
    const name = card.dataset.name || "Pelamar";
    const wage = card.dataset.wage || "-";
    const distance = card.dataset.distance || "-";

    modalBackdrop.querySelector("[data-modal-name]").textContent = name;
    modalBackdrop.querySelector("[data-modal-wage]").textContent = wage;
    modalBackdrop.querySelector("[data-modal-distance]").textContent = `${distance} km`;
    modalBackdrop.hidden = false;
    modalBackdrop.querySelector("button")?.focus();
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.hidden = true;
    selectedApplicantCard = null;
  }

  window.closeModal = closeModal;

  document.querySelectorAll("[data-hire-applicant]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.closest("[data-applicant-card]")));
  });

  document.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) closeModal();
  });

  document.querySelector("[data-confirm-hire]")?.addEventListener("click", () => {
    if (!selectedApplicantCard) return;
    const name = selectedApplicantCard.dataset.name || "Pelamar";
    const wageText = selectedApplicantCard.dataset.wage || "Rp 0";
    const wagePerWorker = Number(wageText.replace(/[^0-9]/g, "")) || 0;
    const quota = getQuotaState();

    if (quota.total > 0 && quota.current >= quota.total) {
      closeModal();
      showToast("Kebutuhan sudah terpenuhi", "Kuota pekerja untuk lowongan ini sudah penuh.");
      return;
    }

    selectedApplicantCard.dataset.status = "hired";
    selectedApplicantCard.querySelector("[data-applicant-status-label]")?.replaceChildren("Terpilih");

    const hireButton = selectedApplicantCard.querySelector("[data-hire-applicant]");
    if (hireButton) {
      hireButton.setAttribute("disabled", "disabled");
      hireButton.classList.remove("button--primary");
      hireButton.classList.add("button--outline");
      hireButton.replaceChildren("Dipilih");
    }

    const actions = selectedApplicantCard.querySelector(".applicant-actions");
    if (actions && !actions.querySelector("[data-contract-action]")) {
      const contractButton = document.createElement("button");
      contractButton.type = "button";
      contractButton.className = "icon-button";
      contractButton.dataset.contractAction = "";
      contractButton.setAttribute("aria-label", "Lihat bukti konfirmasi pekerjaan");
      contractButton.innerHTML = '<span aria-hidden="true" class="material-symbols-rounded">contract</span>';
      contractButton.addEventListener("click", () => {
        showToast("Bukti konfirmasi dibuka", `Catatan konfirmasi MK-1048 untuk ${name} tersedia.`);
      });
      actions.insertBefore(contractButton, hireButton);
    }

    const quotaValues = [...document.querySelectorAll("[data-quota-value]")];
    const quotaRing = document.querySelector("[data-quota-ring]");
    const current = Math.min(quota.current + 1, quota.total || quota.current + 1);
    const total = quota.total || current;

    quotaValues.forEach((quotaValue) => {
      quotaValue.dataset.current = String(current);
      quotaValue.textContent = `${current}/${total}`;
    });

    if (quotaRing) {
      const percentage = Math.min(100, (current / total) * 100);
      quotaRing.style.background = `conic-gradient(var(--orange) 0 ${percentage}%, #edf0ee ${percentage}% 100%)`;
    }

    updateQuotaSummary(current, total, wagePerWorker);
    closeModal();
    filterApplicants();
    showToast("Pekerja dipilih", `${name} dipilih dan catatan konfirmasi pekerjaan telah dibuat.`);
  });

  document.querySelectorAll("[data-contract-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-applicant-card]");
      const name = card?.dataset.name || "pekerja";
      showToast("Bukti konfirmasi dibuka", `Catatan konfirmasi MK-1048 untuk ${name} ditampilkan.`);
    });
  });

  // Generic prototype actions
  document.querySelectorAll("[data-demo-action]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast(button.dataset.demoTitle || "Aksi berhasil", button.dataset.demoMessage || "Interaksi prototipe berhasil dijalankan.");
    });
  });

  function showToast(title, message) {
    const region = document.querySelector("[data-toast-region]");
    if (!region) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
      <div><strong></strong><span></span></div>
    `;
    toast.querySelector("strong").textContent = title;
    toast.querySelector("span:last-child").textContent = message;
    region.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      window.setTimeout(() => toast.remove(), 180);
    }, 3200);
  }
})();
