import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { DataService } from '../data-service/data.service';
import { MatDialog } from '@angular/material/dialog';
import { AddDeviceServerComponent } from './add-device-server.component';

/**
 * `ServersControlComponent` manages state regarding all servers and allow users to connect or
 * disconenct simultaneously.
 *
 * It provides buttons to add a server, disconnect all devices,
 * connect all available devices, and connect selected devices.
 *
 * Buttons are dynamically enabled or disabled based on the
 * current server and device states from `DataService`.
 */
@Component({
  selector: 'app-servers-control',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="flex justify-between items-center w-full">
      <h2 class="text-xl font-bold text-gray-800">Server und Geräte</h2>

      <div class="flex gap-2">
        <button
          class="rounded-md flex gap-2 items-center px-4 bg-omni-red-600 text-slate-200 py-2 font-bold shadow-lg"
          (click)="addNewDeviceServer()">
          Server hinzufügen
        </button>

        <button
          class="rounded-md flex gap-2 items-center px-4 text-slate-200 py-2 font-bold shadow-lg bg-omni-red-500 disabled:bg-gray-500"
          [disabled]="
            dataService.noServerConnected() || dataService.noDeviceSelected()
          "
          (click)="disconnectAll()">
          Alle Verbindungen beenden
          <span class="material-symbols-outlined text-3xl"> stop_circle </span>
        </button>

        <button
          class="rounded-md flex gap-2 items-center px-4 font-bold shadow-lg  text-slate-200 bg-green-500 disabled:bg-gray-500"
          [disabled]="
            dataService.noServerReachable() ||
            !dataService.devicesAvailable() ||
            dataService.allDevicesConnected()
          "
          (click)="connectAll()">
          Alle Geräte verbinden
          <span class="material-symbols-outlined text-3xl"> play_circle </span>
        </button>

        <button
          class="rounded-md flex gap-2 items-center px-4 font-bold shadow-lg  text-slate-200 bg-green-500 disabled:bg-gray-500"
          [disabled]="
            dataService.noServerReachable() ||
            dataService.noDeviceSelected() ||
            dataService.allSelectedDevicesConnected() ||
            dataService.allDevicesConnected()
          "
          (click)="connectSelected()">
          Ausgewählte Geräte verbinden
          <span class="material-symbols-outlined text-3xl"> play_circle </span>
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServersControlComponent {
  readonly dataService = inject(DataService);
  readonly dialog = inject(MatDialog);

  addNewDeviceServer() {
    const dialogRef = this.dialog.open(AddDeviceServerComponent, {
      minWidth: '30vw',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.dataService.addServer(result);
      }
    });
  }

  disconnectAll() {
    this.dataService.disconnectAndUnselectAllDevicesOfAllServers();
  }

  connectAll() {
    this.dataService.connectAllDevicesOfAllServers();
  }

  connectSelected() {
    this.dataService.connectSelectedDevicesOfAllServers();
  }
}
