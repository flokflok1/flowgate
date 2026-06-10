import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CATEGORY_LABELS,
  RequestCategory,
  RequestInput,
} from '../../../core/requests/request.model';
import { RequestsService } from '../../../core/requests/requests.service';

@Component({
  selector: 'app-request-wizard',
  imports: [ReactiveFormsModule],
  templateUrl: './request-wizard.html',
  styleUrl: './request-wizard.scss',
})
export class RequestWizard implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly requests = inject(RequestsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly categories = Object.keys(
    CATEGORY_LABELS,
  ) as RequestCategory[];

  protected readonly currentStep = signal(1);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly stepTitles = ['Grunddaten', 'Details', 'Prüfen & Absenden'];
  private readonly stepHeading =
    viewChild<ElementRef<HTMLElement>>('stepHeading');

  /** id of the draft being edited — null when creating a new request */
  private editId: string | null = null;
  protected readonly isEdit = computed(() => this.editId !== null);

  // one group per wizard step, so each step can be validated on its own
  protected readonly form = this.fb.group({
    step1: this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
      category: ['purchase' as RequestCategory, Validators.required],
    }),
    step2: this.fb.group({
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      amountEur: [null as number | null],
      neededBy: [''],
    }),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.editId = id;
    this.requests.get(id).subscribe({
      next: (request) => {
        this.form.patchValue({
          step1: { title: request.title, category: request.payload.category },
          step2: {
            description: request.payload.description,
            amountEur: request.payload.amountEur ?? null,
            neededBy: request.payload.neededBy ?? '',
          },
        });
      },
      error: () => this.error.set('Antrag konnte nicht geladen werden.'),
    });
  }

  protected nextStep(): void {
    const stepGroup =
      this.currentStep() === 1 ? this.form.controls.step1 : this.form.controls.step2;
    if (stepGroup.invalid) {
      stepGroup.markAllAsTouched(); // show the errors instead of advancing
      return;
    }
    this.currentStep.update((step) => Math.min(step + 1, 3));
    this.focusStepHeading();
  }

  protected prevStep(): void {
    this.currentStep.update((step) => Math.max(step - 1, 1));
    this.focusStepHeading();
  }

  protected onEnter(): void {
    if (this.currentStep() < 3) {
      this.nextStep();
    } else {
      this.submitRequest();
    }
  }

  /** move focus to the step heading so screen readers announce the change */
  private focusStepHeading(): void {
    setTimeout(() => this.stepHeading()?.nativeElement.focus());
  }

  protected cancel(): void {
    this.backToList();
  }

  protected saveDraft(): void {
    this.persist(false);
  }

  protected submitRequest(): void {
    this.persist(true);
  }

  /** Save (create or update) — and optionally submit right after saving. */
  private persist(submitAfterSave: boolean): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const input = this.toInput();
    const save$ = this.editId
      ? this.requests.update(this.editId, input)
      : this.requests.create(input);

    save$.subscribe({
      next: (saved) => {
        if (!submitAfterSave) {
          this.backToList();
          return;
        }
        this.requests.submit(saved.id).subscribe({
          next: () => this.backToList(),
          error: () => this.fail('Einreichen fehlgeschlagen.'),
        });
      },
      error: () => this.fail('Speichern fehlgeschlagen.'),
    });
  }

  private toInput(): RequestInput {
    const { step1, step2 } = this.form.getRawValue();
    return {
      title: step1.title,
      payload: {
        category: step1.category,
        description: step2.description,
        ...(step2.amountEur !== null && { amountEur: Number(step2.amountEur) }),
        ...(step2.neededBy && { neededBy: step2.neededBy }),
      },
    };
  }

  private backToList(): void {
    void this.router.navigateByUrl('/');
  }

  private fail(message: string): void {
    this.saving.set(false);
    this.error.set(message);
  }
}
