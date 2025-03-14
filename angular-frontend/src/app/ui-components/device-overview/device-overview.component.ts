import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DataService } from '../../device-handling/data-service/data.service';
import { ServerCardComponent } from '../device-card/device-card.component';
import { MatDialog } from '@angular/material/dialog';
import { AddDeviceServerComponent } from '../../device-handling/device-selection/add-device-server.component';

@Component({
  selector: 'app-device-overview',
  standalone: true,
  imports: [NgFor, NgIf, ServerCardComponent],
  template: `
    <div class="flex justify-center items-center flex-col gap-8 p-4 w-full">
      <div
        class="grid gap-4 h-full w-full
                  grid-cols-1
                  md:grid-cols-3
                  lg:grid-cols-4">
        <ng-container *ngIf="serversKeys.length; else noServers">
          <app-server-card
            *ngFor="let serverKey of serversKeys"
            [server]="servers[serverKey]"
            class="flex h-[75%]">
          </app-server-card>
        </ng-container>
        <ng-template #noServers>
          <p class="text-center w-full">Keine Server verfügbar</p>
        </ng-template>
      </div>
      <button
        class="bg-omni-red-700 rounded-md px-8 py-4 text-slate-200 font-bold"
        (click)="addNewDeviceServer()">
        Server hinzufügen
      </button>
    </div>
  `,
})
export class DeviceOverviewComponent {
  private readonly dataService = inject(DataService);
  readonly #dialog = inject(MatDialog);

  servers = this.dataService.servers();
  serversKeys = Object.keys(this.servers);

  addNewDeviceServer() {
    const dialogRef = this.#dialog.open(AddDeviceServerComponent, {
      minWidth: '30vw',
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log(result);
        this.dataService.addServer(result);
      }
    });
  }
}
