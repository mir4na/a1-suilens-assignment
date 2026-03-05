<template>
  <v-container class="py-10" max-width="1200">
    <v-row>
      <v-col cols="12" md="7">
        <div class="text-h3 font-weight-bold mb-2">Suilens Branch Inventory</div>
        <div class="text-subtitle-1 text-medium-emphasis mb-6">
          Lihat stok lensa di tiap cabang dan pilih lokasi pengambilan.
        </div>

        <v-row>
          <v-col v-for="lens in lenses" :key="lens.id" cols="12">
            <v-card rounded="lg" variant="tonal">
              <v-card-title class="text-h6 font-weight-bold">
                {{ lens.modelName }}
              </v-card-title>
              <v-card-subtitle>
                {{ lens.manufacturerName }} · {{ lens.mountType }}
              </v-card-subtitle>
              <v-card-text>
                <div class="d-flex flex-wrap ga-2">
                  <v-chip
                    v-for="branch in inventoryByLensId[lens.id] || []"
                    :key="branch.branchCode"
                    :color="branch.availableQuantity > 0 ? 'green' : 'red'"
                    variant="tonal"
                  >
                    {{ branch.branchName }} ({{ branch.branchCode }}): {{ branch.availableQuantity }} unit
                  </v-chip>
                </div>
                <div class="mt-4 text-body-2">
                  Rp {{ formatCurrency(lens.dayPrice) }} / hari
                </div>
              </v-card-text>
              <v-card-actions>
                <v-btn variant="text" @click="selectedLensId = lens.id">Pilih untuk pesan</v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <v-col cols="12" md="5">
        <v-card rounded="lg" elevation="6">
          <v-card-title class="text-h6 font-weight-bold">Buat Pesanan</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="submitOrder">
              <v-select
                v-model="selectedLensId"
                :items="lensOptions"
                label="Pilih lensa"
                variant="outlined"
                class="mb-4"
              />
              <v-select
                v-model="selectedBranch"
                :items="branchOptions"
                label="Cabang pengambilan"
                variant="outlined"
                class="mb-4"
              />
              <v-text-field
                v-model="form.customerName"
                label="Nama lengkap"
                variant="outlined"
                class="mb-4"
              />
              <v-text-field
                v-model="form.customerEmail"
                label="Email"
                variant="outlined"
                type="email"
                class="mb-4"
              />
              <v-text-field
                v-model="form.startDate"
                label="Tanggal mulai"
                variant="outlined"
                type="date"
                class="mb-4"
              />
              <v-text-field
                v-model="form.endDate"
                label="Tanggal selesai"
                variant="outlined"
                type="date"
                class="mb-6"
              />

              <v-btn
                color="primary"
                type="submit"
                block
                :loading="loading"
                :disabled="!canSubmit"
              >
                Pesan sekarang
              </v-btn>
            </v-form>

            <v-alert v-if="error" type="error" variant="tonal" class="mt-4">
              {{ error }}
            </v-alert>
            <v-alert v-if="success" type="success" variant="tonal" class="mt-4">
              {{ success }}
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card v-if="selectedLens" class="mt-6" rounded="lg" variant="outlined">
          <v-card-title class="text-subtitle-1 font-weight-bold">Ringkasan Lensa</v-card-title>
          <v-card-text>
            <div class="text-body-2">{{ selectedLens.modelName }}</div>
            <div class="text-body-2">{{ selectedLens.manufacturerName }}</div>
            <div class="text-body-2">Stok tersedia: {{ totalAvailable }} unit</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';

const apiBase = import.meta.env.VITE_API_BASE || '';
const catalogApi = apiBase ? `${apiBase}/api/catalog` : (import.meta.env.VITE_CATALOG_API || 'http://localhost:3001');
const orderApi = apiBase ? `${apiBase}/api/orders` : (import.meta.env.VITE_ORDER_API || 'http://localhost:3002');
const inventoryApi = apiBase ? `${apiBase}/api/inventory` : (import.meta.env.VITE_INVENTORY_API || 'http://localhost:3004');

const lenses = ref([]);
const inventoryByLensId = ref({});
const selectedLensId = ref('');
const selectedBranch = ref('');
const loading = ref(false);
const error = ref('');
const success = ref('');
const form = ref({
  customerName: '',
  customerEmail: '',
  startDate: '',
  endDate: '',
});

const lensOptions = computed(() =>
  lenses.value.map((lens) => ({
    title: `${lens.modelName} - ${lens.manufacturerName}`,
    value: lens.id,
  }))
);

const selectedLens = computed(() => lenses.value.find((lens) => lens.id === selectedLensId.value));

const branchesForSelected = computed(() => inventoryByLensId.value[selectedLensId.value] || []);

const totalAvailable = computed(() =>
  branchesForSelected.value.reduce((sum, branch) => sum + (branch.availableQuantity || 0), 0)
);

const branchOptions = computed(() =>
  branchesForSelected.value.map((branch) => ({
    title: `${branch.branchName} (${branch.branchCode}) - ${branch.availableQuantity} unit`,
    value: branch.branchCode,
    props: { disabled: branch.availableQuantity === 0 },
  }))
);

const canSubmit = computed(() =>
  Boolean(
    selectedLensId.value &&
    selectedBranch.value &&
    form.value.customerName &&
    form.value.customerEmail &&
    form.value.startDate &&
    form.value.endDate &&
    totalAvailable.value > 0
  )
);

const formatCurrency = (value) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return value;
  return new Intl.NumberFormat('id-ID').format(numberValue);
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || 'Gagal mengambil data';
    throw new Error(message);
  }
  return response.json();
};

const loadInventory = async (lensId) => {
  const data = await fetchJson(`${inventoryApi}/lenses/${lensId}`);
  inventoryByLensId.value = {
    ...inventoryByLensId.value,
    [lensId]: data,
  };
};

const loadLenses = async () => {
  const data = await fetchJson(`${catalogApi}/lenses`);
  lenses.value = data;
  await Promise.all(data.map((lens) => loadInventory(lens.id)));
  if (!selectedLensId.value && data[0]) {
    selectedLensId.value = data[0].id;
  }
};

const submitOrder = async () => {
  error.value = '';
  success.value = '';
  loading.value = true;

  try {
    const payload = {
      customerName: form.value.customerName,
      customerEmail: form.value.customerEmail,
      lensId: selectedLensId.value,
      branchCode: selectedBranch.value,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
    };

    const response = await fetch(`${orderApi}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'Gagal membuat pesanan');
    }

    success.value = `Pesanan berhasil dibuat. ID: ${result.id}`;
    await loadInventory(selectedLensId.value);
  } catch (err) {
    error.value = err.message || 'Terjadi kesalahan';
  } finally {
    loading.value = false;
  }
};

watch([selectedLensId, inventoryByLensId], () => {
  const options = branchesForSelected.value;
  const valid = options.find((branch) => branch.branchCode === selectedBranch.value && branch.availableQuantity > 0);
  if (!valid) {
    const firstAvailable = options.find((branch) => branch.availableQuantity > 0);
    selectedBranch.value = firstAvailable ? firstAvailable.branchCode : '';
  }
});

onMounted(() => {
  loadLenses().catch((err) => {
    error.value = err.message || 'Gagal memuat data';
  });
});
</script>
