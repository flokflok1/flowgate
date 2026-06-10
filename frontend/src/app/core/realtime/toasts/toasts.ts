import { Component, inject } from '@angular/core';
import { RealtimeService } from '../realtime.service';

@Component({
  selector: 'app-toasts',
  imports: [],
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
})
export class Toasts {
  protected readonly realtime = inject(RealtimeService);
}
