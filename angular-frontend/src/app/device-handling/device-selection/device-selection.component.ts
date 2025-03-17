import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ServersControlComponent } from "./servers-control.component";
import { ServersOverviewComponent } from "./servers-overview.component";

@Component({
  selector: 'app-device-selection',
  standalone: true,
  imports: [ServersControlComponent, ServersOverviewComponent],
  templateUrl: './device-selection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSelectionComponent {}
