const API_URL = '/api/crops';
let cropData = [];
let expandedCropName = null;
let selectedSiloCapacity = null;
let customSiloValue = null;
let lastUpdatedTime = Date.now();

const secondsToTime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', s && !h ? `${s}s` : ''].filter(Boolean).join(' ');
};

async function fetchData() {
  try {
    const prevSearch = document.getElementById("search").value;
    const prevSort = document.getElementById("sort").value;
    const prevSeedType = document.getElementById("seed-type").value;

    const res = await fetch(API_URL);
    cropData = await res.json();

    populateSeedTypes();

    document.getElementById("search").value = prevSearch;
    document.getElementById("sort").value = prevSort;
    document.getElementById("seed-type").value = prevSeedType;

    renderList();

    lastUpdatedTime = Date.now();
  } catch (err) {
    console.error("Failed to fetch crop data", err);
  }
}

setInterval(() => {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - lastUpdatedTime) / 1000);
  const updatedText = `Last refreshed: ${diffInSeconds}s ago`;
  const el = document.getElementById("last-updated");
  if (el) el.textContent = updatedText;
}, 1000);



function populateSeedTypes() {
  const seedTypeSelect = document.getElementById("seed-type");
  const uniqueTypes = [...new Set(cropData.map(c => c.type))].sort();
  seedTypeSelect.innerHTML = '<option value="">Filter Seed Type</option>';
  uniqueTypes.forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    seedTypeSelect.appendChild(opt);
  });
}

function renderList() {
  const searchVal = document.getElementById("search").value.toLowerCase();
  const sortVal = document.getElementById("sort").value;
  const seedTypeVal = document.getElementById("seed-type").value;

  const container = document.getElementById("plant-list");
  const siloContainer = document.getElementById("silo-options");

  container.innerHTML = "";

  let filtered = cropData
    .filter(crop => crop.name.toLowerCase().includes(searchVal))
    .filter(crop => !seedTypeVal || crop.type === seedTypeVal);

  if (sortVal === "rating") {
    siloContainer.style.display = "none";
    filtered.sort((a, b) => b.cropValueRating - a.cropValueRating);
  } else if (sortVal === "maturing") {
    siloContainer.style.display = "none";
    filtered.sort((a, b) => a.maturingTime - b.maturingTime);
  } else if (sortVal === "silo") {
    siloContainer.style.display = "flex";
    renderSiloButtons();

    if (selectedSiloCapacity) {
      filtered = filtered
        .map(crop => {
          const grossRevenue = (selectedSiloCapacity * crop.cropValuePer1k) / 1000;
          const revenue = grossRevenue * 0.85;
          return { ...crop, revenue };
        })
        .sort((a, b) => b.revenue - a.revenue);
    }
  } else {
    siloContainer.style.display = "none";
  }

  filtered.forEach(crop => {
    const div = document.createElement("div");
    div.className = "plant";

    const rating = Number(crop.cropValueRating).toFixed(2);
    let color = rating >= 70 ? "green" : rating >= 40 ? "orange" : "red";

    const shortInfo = document.createElement("div");
    shortInfo.className = "short-info";

    if (sortVal === "silo" && selectedSiloCapacity) {
      shortInfo.innerHTML = `
        <strong>${crop.name}</strong> <span class="rating" style="color: ${color};">(${rating}%)</span><br/>
        Revenue: $${crop.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})} <small>(-15%)</small><br/>
        Silo: ${selectedSiloCapacity.toLocaleString()} kg<br/>
        Seed Type: ${crop.type}<br/>
        Crop Value Rating: ${rating}%<br/>
        Crop Value per 1K: $${Number(crop.cropValuePer1k).toFixed(2)}<br/>
        Seed Cost: $${Number(crop.seedCost).toFixed(2)}
      `;
    } else {
      shortInfo.innerHTML = `
        <strong>${crop.name}</strong> <span class="rating" style="color: ${color};">(${rating}%)</span><br/>
        Seed Type: ${crop.type}<br/>
        Crop Value Rating: ${rating}%<br/>
        Crop Value per 1K: $${Number(crop.cropValuePer1k).toFixed(2)}<br/>
        Seed Cost: $${Number(crop.seedCost).toFixed(2)}
      `;
    }

    const expand = document.createElement("div");
    expand.className = "expand";
    expand.innerHTML = `
      Kg per Ha: ${crop.kgPerHa}<br/>
      Yield per Ha: ${crop.yieldPerHa}<br/>
      Temp Max (°C): ${crop.tempMaxC}<br/>
      Best pH: ${Number(crop.bestPh).toFixed(2)}<br/>
      Irrigation: ${Number(crop.irrigation).toFixed(2)}<br/>
      Maturing Time: ${secondsToTime(Number(crop.maturingTime))}<br/>
      Ha Traded: ${Number(crop.haTraded).toFixed(2)}<br/>
      <button class="calc-btn">💰 Calculate Income</button>
    `;

    if (crop.name === expandedCropName) {
      expand.style.display = "block";
    }

    div.onclick = (e) => {
      const allPlants = document.querySelectorAll('.plant');
      allPlants.forEach(p => {
        const exp = p.querySelector('.expand');
        if (exp) exp.style.display = 'none';
      });

      const isExpanding = expand.style.display !== "block";
      expand.style.display = isExpanding ? "block" : "none";
      expandedCropName = isExpanding ? crop.name : null;
    };

    div.appendChild(shortInfo);
    div.appendChild(expand);
    container.appendChild(div);

    setTimeout(() => {
      const btn = expand.querySelector(".calc-btn");
      if (btn && sortVal !== "silo") {
        btn.onclick = (event) => {
          event.stopPropagation();
          openModal(crop);
        };
      } else if (btn && sortVal === "silo") {
        btn.remove();
      }
    }, 0);
  });
}

function renderSiloButtons() {
  const options = [100000, 200000, "CUSTOM"];
  const container = document.getElementById("silo-options");
  container.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = typeof opt === "number" ? `${opt / 1000}K` : `CUSTOM AMOUNT`;
    btn.classList.add("silo-btn");

    if (selectedSiloCapacity === opt) {
      btn.classList.add("selected");
      btn.disabled = true;
    }

    btn.onclick = () => {
      if (opt === "CUSTOM") {
        document.getElementById("custom-silo-box").style.display = "block";
        return;
      } else {
        selectedSiloCapacity = opt;
        customSiloValue = null;
      }

      document.querySelectorAll(".silo-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      btn.disabled = true;

      renderList();
    };

    container.appendChild(btn);
  });
}

document.getElementById("custom-silo-submit").onclick = () => {
  const input = document.getElementById("custom-silo-input").value;
  if (input && !isNaN(input) && input > 0) {
    selectedSiloCapacity = parseFloat(input);
    customSiloValue = selectedSiloCapacity;
    document.getElementById("custom-silo-box").style.display = "none";
    document.getElementById("custom-silo-input").value = "";

    document.querySelectorAll(".silo-btn").forEach(b => b.classList.remove("selected"));
    renderList();
  } else {
    alert("Please enter a valid number greater than 0.");
  }
};

document.getElementById("custom-silo-cancel").onclick = () => {
  document.getElementById("custom-silo-box").style.display = "none";
  document.getElementById("custom-silo-input").value = "";
};

function openModal(crop) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal">
      <h2>💰 Sell ${crop.name}</h2>
      <input type="number" placeholder="Amount (kg)" id="kg-input" min="1" />
      <div style="text-align: center; margin: 0.5rem 0;">OR</div>
      <input type="number" placeholder="Area (ha)" id="ha-input" min="0.01" step="0.01" />
      <small id="ha-warning" style="color: #cc8800; display: none; margin-bottom: 1rem;">
        ⚠️ 100% crop suitability, fertilizer, irrigation are needed.️
      </small>
      <div class="result" id="income-result"></div>
      <div class="buttons">
        <button class="btn-calc">Calculate</button>
        <button class="btn-cancel">Cancel</button>
      </div>
    </div>
  `;

  const container = document.getElementById("modal-container");
  container.innerHTML = "";
  container.appendChild(modal);
  container.style.display = "block";

  const kgInputField = modal.querySelector("#kg-input");
  const haInputField = modal.querySelector("#ha-input");
  const haWarning = modal.querySelector("#ha-warning");

  kgInputField.addEventListener("input", () => {
    haInputField.disabled = !!kgInputField.value.trim();
  });

  haInputField.addEventListener("input", () => {
    kgInputField.disabled = !!haInputField.value.trim();
  });

  haInputField.addEventListener("click", () => {
    haWarning.style.display = "block";
  });

  kgInputField.addEventListener("click", () => {
    haWarning.style.display = "none";
  });

  modal.querySelector(".btn-cancel").onclick = () => {
    container.style.display = "none";
    container.innerHTML = "";
  };

  modal.querySelector(".btn-calc").onclick = () => {
    const kgInput = kgInputField.value.trim();
    const haInput = haInputField.value.trim();
    let amount = parseFloat(kgInput);
    const ha = parseFloat(haInput);

    if ((!amount || isNaN(amount)) && ha && !isNaN(ha)) {
      amount = ha * 2114;
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      modal.querySelector("#income-result").textContent = "Please enter a valid amount or area.";
      return;
    }

    const gross = amount * (crop.cropValuePer1k / 1000);
    const feePercent = 15;
    const fee = gross * (feePercent / 100);
    const net = gross - fee;

    modal.querySelector("#income-result").innerHTML = `
      Gross: $${gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
      Brokerage Fee (${feePercent}%): -$${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
      <strong>Net Income: $${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
    `;
  };
}

document.getElementById("search").addEventListener("input", renderList);
document.getElementById("sort").addEventListener("change", () => {
  const sortVal = document.getElementById("sort").value;

  if (sortVal === "silo" && !selectedSiloCapacity) {
    selectedSiloCapacity = 100000;
    customSiloValue = null;
  }

  renderList();
});

document.getElementById("seed-type").addEventListener("change", renderList);

fetchData();
setInterval(fetchData, 8000);
