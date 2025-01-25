<template>
  <div class="app">
    <div class="container">
      <div class="mode">
        <button @click="toggleMode" class="mode-button">
          <span>{{
            isEditMode ? "Режим редактирования" : "Режим просмотра"
          }}</span>
        </button>
        <button @click="undo">↩️</button>
        <button @click="redo">↪️</button>
      </div>

      <ag-grid-vue
        style="width: 100%; height: 80%"
        class="ag-theme-alpine"
        theme="legacy"
        :rowData="rowData"
        :columnDefs="columnDefs"
        :groupDefaultExpanded="groupDefaultExpanded"
        :autoGroupColumnDef="autoGroupColumnDef"
        :treeData="true"
        :getDataPath="getDataPath"
        :suppressDragLeaveHidesColumns="true"
        :suppressMoveWhenRowDragging="true"
        @cellValueChanged="onCellValueChanged"
        @cellEditingStarted="onCellEditingStarted"
        @cellEditingStopped="onCellEditingStopped"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import {
  ModuleRegistry,
  ClientSideRowModelModule,
  TreeDataModule,
  TextEditorModule,
} from "ag-grid-enterprise";

ModuleRegistry.registerModules([TextEditorModule]);

import type { ColDef } from "ag-grid-enterprise";
import TreeStore from "./utils/Tree.ts";
import { v4 as uuidv4 } from "uuid";
ModuleRegistry.registerModules([ClientSideRowModelModule, TreeDataModule]);

interface Item {
  id: string | number;
  parent: string | number | null;
  label: string;
}

const initialItems: Item[] = [
  { id: 1, parent: null, label: "Айтем 1" },
  { id: "2", parent: 1, label: "Айтем 2" },
  { id: 3, parent: 1, label: "Айтем 3" },
  { id: 4, parent: "2", label: "Айтем 4" },
  { id: 5, parent: "2", label: "Айтем 5" },
  { id: 6, parent: "2", label: "Айтем 6" },
  { id: 7, parent: 4, label: "Айтем 7" },
  { id: 8, parent: 4, label: "Айтем 8" },
];

let treeStore = new TreeStore<Item>(initialItems);
const isEditMode = ref(false);
const snapshots = ref<Item[][]>([]);
const currentSnapshotIndex = ref(-1);

const createSnapshot = () => {
  const snapshot = treeStore.getAll();

  if (currentSnapshotIndex.value < snapshots.value.length - 1) {
    snapshots.value = snapshots.value.slice(0, currentSnapshotIndex.value + 1);
  }

  const lastSnapshot = snapshots.value[snapshots.value.length - 1];
  if (
    lastSnapshot &&
    JSON.stringify(lastSnapshot) === JSON.stringify(snapshot)
  ) {
    return;
  }

  const newSnapshot = JSON.parse(JSON.stringify(snapshot));
  snapshots.value.push(newSnapshot);

  currentSnapshotIndex.value = snapshots.value.length - 1;
};

const restoreSnapshot = (index: number) => {
  if (index >= 0 && index < snapshots.value.length) {
    const snapshot = snapshots.value[index];
    treeStore = new TreeStore<Item>(snapshot);
    refreshRowData();
    currentSnapshotIndex.value = index;
  }
};

const undo = () => {
  if (currentSnapshotIndex.value > 0) {
    restoreSnapshot(currentSnapshotIndex.value - 1);
  }
};

const redo = () => {
  if (currentSnapshotIndex.value < snapshots.value.length - 1) {
    restoreSnapshot(currentSnapshotIndex.value + 1);
  }
};

watch(currentSnapshotIndex, (newValue, oldValue) => {
  console.log(`currentSnapshotIndex changed from ${oldValue} to ${newValue}`);
});

const rowData = ref<Item[]>([]);

onMounted(() => {
  rowData.value = treeStore.getAll().map((item, index) => ({
    ...item,
    index: index + 1,
    category: treeStore.getChildren(item.id).length > 0 ? "Группа" : "Элемент",
  }));
  createSnapshot();
});
const baseColumnDefs: ColDef[] = [
  {
    field: "label",
    headerName: "Название",
    editable: (params) => params.data?.isNewRow,

    flex: 1,
    cellRenderer: (params: any) => {
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.justifyContent = "space-between";
      container.style.alignItems = "center";
      container.style.width = "100%";

      const label = document.createElement("span");
      label.textContent = params.value;
      label.style.marginRight = "5px";
      container.appendChild(label);

      if (isEditMode.value) {
        const buttonsContainer = document.createElement("div");
        buttonsContainer.style.display = "flex";
        buttonsContainer.style.gap = "5px";

        const addButton = document.createElement("button");
        addButton.textContent = "+";
        addButton.style.backgroundColor = "#4CAF50";
        addButton.style.color = "white";
        addButton.style.border = "none";
        addButton.style.borderRadius = "50%";
        addButton.style.width = "25px";
        addButton.style.height = "25px";
        addButton.style.padding = "5px";
        addButton.style.cursor = "pointer";

        addButton.addEventListener("click", () => onAddRow(params));

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "×";
        deleteButton.style.backgroundColor = "#f44336";
        deleteButton.style.color = "white";
        deleteButton.style.border = "none";
        deleteButton.style.borderRadius = "50%";
        deleteButton.style.width = "25px";
        deleteButton.style.height = "25px";
        deleteButton.style.padding = "5px";
        deleteButton.style.cursor = "pointer";

        deleteButton.addEventListener("click", () => onDeleteRow(params));

        buttonsContainer.appendChild(addButton);
        buttonsContainer.appendChild(deleteButton);

        container.appendChild(buttonsContainer);
      }

      return container;
    },
  },
  { field: "index", headerName: "№ п/п", flex: 0.5 },
];

const columnDefs = ref([...baseColumnDefs]);

const toggleMode = () => {
  isEditMode.value = !isEditMode.value;

  columnDefs.value = [...baseColumnDefs];
};

const onAddRow = (params: any) => {
  const newItem = {
    id: uuidv4(),
    parent: params.data.id,
    label: "",
    isNewRow: true,
  };
  treeStore.addItem(newItem);
  refreshRowData();
  const gridApi = params.api;

  const newRowIndex = rowData.value.length - 1;

  gridApi.startEditingCell({
    rowIndex: newRowIndex,
    colKey: "label",
  });
};

const onCellEditingStarted = (event: any) => {
  const rowNode = event.node;

  if (!rowNode.data.isNewRow) {
    event.api.stopEditing();
  }
};

const onDeleteRow = (params: any) => {
  treeStore.removeItem(params.data.id);
  refreshRowData();
  createSnapshot();
};

const autoGroupColumnDef = ref({
  headerName: "Категория",
  cellRendererParams: {
    suppressCount: true,
    innerRenderer: (params: any) => {
      return params.data ? params.data.category : "";
    },
  },
  flex: 1,
});

const groupDefaultExpanded = ref(-1);

const getDataPath = (data: any) => {
  const path: string[] = [];
  let current = data;

  while (current.parent !== null) {
    const parent = treeStore.getItem(current.parent);
    if (parent) {
      path.unshift(`${parent.id}`);
      current = parent;
    } else {
      break;
    }
  }

  path.push(`${data.id}`);
  return path;
};

const onCellValueChanged = (event: any) => {
  if (isEditMode.value) {
    const updatedItem = treeStore.getItem(event.data.id);
    if (updatedItem) {
      updatedItem.label = event.newValue;
      treeStore.updateItem(updatedItem);
      refreshRowData();
      createSnapshot();
    }
  }
};

const onCellEditingStopped = (event: any) => {
  const rowNode = event.node;

  if (rowNode.data.isNewRow) {
    rowNode.data.isNewRow = false;
  }
};

const refreshRowData = () => {
  rowData.value = treeStore.getAll().map((item, index) => ({
    ...item,
    index: index + 1,
    category: treeStore.getChildren(item.id).length > 0 ? "Группа" : "Элемент",
  }));
};
</script>

<style>
@import "ag-grid-enterprise/styles/ag-grid.css";
@import "ag-grid-enterprise/styles/ag-theme-alpine.css";

.app {
  background-color: #cccccc89;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.container {
  border-radius: 4px;

  padding: 0 10px;
  background-color: white;

  width: 85%;
  height: 95vh;
}
.mode {
  display: flex;
  margin: 20px 0;
  gap: 5px;
  button {
    height: 50px;
    width: 50px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    border-radius: 5px;
    background-color: rgba(0, 0, 0, 0.1);
  }
  .mode-button {
    width: 250px;
    font-size: medium;
  }
}
</style>
