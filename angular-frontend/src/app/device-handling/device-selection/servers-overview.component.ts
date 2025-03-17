import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DataService } from '../data-service/data.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-servers-overview',
  imports: [CommonModule],
  template: `
    <div
      class="grid gap-4 w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      @for (server of dataService.servers() | keyvalue; track server.key) {
        @let serverURL = server.key;
        @let serverObj = server.value;

        <div
          class="bg-omni-schwarz-700 shadow-md rounded-lg p-4 relative min-h-[25vh]">
          @if (!serverObj.serverIsReachable()) {
            <div
              class="absolute inset-0 w-full h-full bg-gray-600/60 flex items-center justify-center rounded-lg">
              <span class="material-symbols-outlined text-white text-4xl mr-2"
                >cloud_off</span
              >
              <span class="text-white text-lg">Server unerreichbar</span>
            </div>
          }

          <div class="flex items-center justify-between px-4 py-s">
            <h3 class="text-lg font-semibold text-slate-200">
              {{ serverURL }}
            </h3>
            <button
              [ngClass]="{
                'text-green-500':
                  !serverObj.isConnected() &&
                  serverObj.numSelectedDevices() > 0,
                'text-red-500': serverObj.isConnected(),
                'text-gray-500':
                  !serverObj.isConnected() &&
                  serverObj.numSelectedDevices() === 0,
              }"
              class="px-4 py-2 rounded-md flex items-center"
              (click)="
                serverObj.isConnected()
                  ? serverObj.disconnect()
                  : serverObj.connect()
              "
              [disabled]="
                !serverObj.isConnected() && serverObj.numSelectedDevices() === 0
              ">
              <span class="material-symbols-outlined text-4xl">
                {{ serverObj.isConnected() ? 'stop_circle' : 'play_circle' }}
              </span>
            </button>
          </div>

          <div class="mt-2">
            <ul class="flex flex-col gap-2 p-4">
              @for (device of serverObj.devices(); track device.UUID) {
                <li class="flex items-center gap-4 p-2">
                  <input
                    type="checkbox"
                    [checked]="serverObj.isDeviceSelected()(device.UUID)"
                    (change)="serverObj.toggleSelectStateOfDevice(device.UUID)"
                    [disabled]="serverObj.isConnected()"
                    class="h-5 w-5 border-gray-300 rounded" />
                  <label
                    class="ml-2 font-bold"
                    [style.color]="
                      dataService.curveColors()[device.UUID] || '#000000'
                    "
                    [style.text-shadow]="'2px 2px 2px black'">
                    {{ device.UUID }}
                  </label>
                </li>
              } @empty {
                <p class="text-gray-500">Keine Geräte gefunden</p>
              }
            </ul>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServersOverviewComponent {
  readonly dataService = inject(DataService);
}
