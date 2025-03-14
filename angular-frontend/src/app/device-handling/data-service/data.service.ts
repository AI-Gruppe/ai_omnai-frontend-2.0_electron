import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ServerDescription } from './omnAIServer';
import { DataFormat } from './data.models';

@Injectable({ providedIn: 'root' })
export class DataService {
  readonly httpClient = inject(HttpClient);
  readonly #servers = signal<Record<string, ServerDescription>>({});
  readonly servers = this.#servers.asReadonly();

  data = computed(() => {
    const combinedData: Record<string, DataFormat[]> = {};
    for (const [serverURL, server] of Object.entries(this.servers())) {
      // Here we're assuming that `server.data()` returns Record<string, DataFormat[]>
      const serverData = server.data();
      for (const [uuid, dataArray] of Object.entries(serverData)) {
        if (!combinedData[uuid]) {
          combinedData[uuid] = [];
        }
        combinedData[uuid] = combinedData[uuid].concat(dataArray);
      }
    }
    return combinedData;
  });

  limitedData = computed(() => {
    const combinedData: Record<string, DataFormat[]> = {};
    for (const [serverURL, server] of Object.entries(this.servers())) {
      const serverData = server.limitedData();
      for (const [uuid, dataArray] of Object.entries(serverData)) {
        if (!combinedData[uuid]) {
          combinedData[uuid] = [];
        }
        combinedData[uuid] = combinedData[uuid].concat(dataArray);
      }
    }
    return combinedData;
  });

  // these colors can be used as fill colors
  curveColors = computed(() => {
    const colors: Record<string, string> = {};
    for (const server of Object.values(this.servers())) {
      for (const device of server.devices()) {
        const { r, g, b } = device.color;
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        colors[device.UUID] = hexColor;
      }
    }
    return colors;
  });

  constructor() {
    this.addServer('127.0.0.1:8080');
  }

  addServer(serverURL: string) {
    const server = new ServerDescription(serverURL, this.httpClient);
    this.#servers.update(servers => ({ ...servers, [serverURL]: server }));
  }

  removeServer(serverURL: string) {
    this.#servers.update(servers => {
      const newServers = { ...servers };
      delete newServers[serverURL];
      return newServers;
    });
  }

  connect(serverURL: string): void {
    const server = this.servers()[serverURL];
    if (!server) throw new Error(`Server ${serverURL} not found`);
    server.connect();
  }

  disconnect(serverURL: string): void {
    const server = this.servers()[serverURL];
    if (server) server.disconnect();
  }
}
