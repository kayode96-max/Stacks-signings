const state = {
  signers: ["alice.stx", "bob.stx", "charlie.stx"],
  threshold: 2,
  txns: [],
  selectedTxnId: null,
};

const thresholdDisplay = document.getElementById("threshold-display");
const pendingCount = document.getElementById("pending-count");
const signerList = document.getElementById("signer-list");
const signerSelect = document.getElementById("signer-select");
const signerForm = document.getElementById("signer-form");
const signerInput = document.getElementById("signer-input");
const thresholdInput = document.getElementById("threshold-input");
const txnForm = document.getElementById("txn-form");
const txnType = document.getElementById("txn-type");
const txnAmount = document.getElementById("txn-amount");
const txnRecipient = document.getElementById("txn-recipient");
const txnToken = document.getElementById("txn-token");
const txnList = document.getElementById("txn-list");
const signButton = document.getElementById("sign-txn");

const render = () => {
  thresholdDisplay.textContent = `${state.threshold} of ${state.signers.length}`;
  pendingCount.textContent = String(state.txns.filter((t) => !t.executed).length);

  signerList.innerHTML = "";
  state.signers.forEach((signer) => {
    const li = document.createElement("li");
    li.className = "chip";
    li.textContent = signer;
    signerList.appendChild(li);
  });

  signerSelect.innerHTML = "";
  state.signers.forEach((signer) => {
    const option = document.createElement("option");
    option.value = signer;
    option.textContent = signer;
    signerSelect.appendChild(option);
  });

  txnList.innerHTML = "";
  state.txns.forEach((txn) => {
    const card = document.createElement("div");
    card.className = "txn";

    const status = txn.executed ? "Executed" : "Pending";
    const label = txn.type === "sip010" ? "SIP-010" : "STX";

    card.innerHTML = `
      <div class="row">
        <strong>#${txn.id}</strong>
        <span class="badge">${label}</span>
        <span class="status">${status}</span>
      </div>
      <div>${txn.amount} to ${txn.recipient}</div>
      <small>${txn.token ? `Token: ${txn.token}` : "Native transfer"}</small>
      <small>Signatures: ${txn.signatures.length} / ${state.threshold}</small>
      <button type="button" data-id="${txn.id}">
        ${txn.executed ? "Executed" : "Select transaction"}
      </button>
    `;

    const button = card.querySelector("button");
    button.disabled = txn.executed;
    button.addEventListener("click", () => {
      state.selectedTxnId = txn.id;
      [...txnList.querySelectorAll("button")].forEach((btn) => {
        btn.classList.remove("primary");
      });
      button.classList.add("primary");
    });

    txnList.appendChild(card);
  });
};

const addSigner = (name) => {
  if (!name || state.signers.includes(name)) return;
  state.signers.push(name);
  if (state.threshold > state.signers.length) {
    state.threshold = state.signers.length;
    thresholdInput.value = String(state.threshold);
  }
  render();
};

const submitTxn = () => {
  const newTxn = {
    id: state.txns.length,
    type: txnType.value,
    amount: Number(txnAmount.value),
    recipient: txnRecipient.value,
    token: txnToken.value.trim() || null,
    signatures: [],
    executed: false,
  };

  state.txns.unshift(newTxn);
  state.selectedTxnId = newTxn.id;
  render();
};

const signSelected = () => {
  const signer = signerSelect.value;
  const txn = state.txns.find((item) => item.id === state.selectedTxnId);
  if (!txn || txn.executed) return;
  if (!txn.signatures.includes(signer)) {
    txn.signatures.push(signer);
  }
  if (txn.signatures.length >= state.threshold) {
    txn.executed = true;
  }
  render();
};

signerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addSigner(signerInput.value.trim());
  signerInput.value = "";
});

thresholdInput.addEventListener("change", (event) => {
  const value = Number(event.target.value);
  if (Number.isNaN(value)) return;
  state.threshold = Math.max(1, Math.min(value, state.signers.length));
  thresholdInput.value = String(state.threshold);
  render();
});

txnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitTxn();
  txnRecipient.value = "";
  txnToken.value = "";
});

signButton.addEventListener("click", signSelected);

render();
