import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './core/realtime/toasts/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
