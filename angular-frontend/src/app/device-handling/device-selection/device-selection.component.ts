import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { DataService } from '../data-service/data.service';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { AddDeviceServerComponent } from './add-device-server.component';

@Component({
  selector: 'app-device-selection',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatListModule, MatCheckboxModule],
  templateUrl: './device-selection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSelectionComponent {
  readonly dataService = inject(DataService);
  readonly #dialog = inject(MatDialog);
  readonly selectedUUIDs = signal<Set<string>>(new Set());

  toggleDeviceSelection(uuid: string) {
    this.selectedUUIDs.update(selected => {
      const updatedSet = new Set(selected);
      if (updatedSet.has(uuid)) {
        updatedSet.delete(uuid);
      } else {
        updatedSet.add(uuid);
      }
      return updatedSet;
    });
  }

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
