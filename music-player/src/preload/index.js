import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info')
}

contextBridge.exposeInMainWorld('api', api)
