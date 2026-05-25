/**
 * IdpForm — conditional field rendering, validation, and submit behavior.
 * Uses react-hook-form FormProvider to wrap the component (it uses useFormContext).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IdpForm } from '../../components/sso/IdpForm';
import { idpFormSchema, type IdpFormValues } from '../../lib/sso-schema';

// ─── Mock heavy UI dependencies ───────────────────────────────────────────────

jest.mock('../../components/ui/input', () => ({
    Input: ({ label, error, ...props }: any) => (
        <div>
            <label htmlFor={props.id || props.name}>{label}</label>
            <input id={props.id || props.name} aria-label={label} {...props} />
            {error && <span role="alert">{error}</span>}
        </div>
    ),
}));

jest.mock('../../lib/utils', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

// ─── Wrapper with FormProvider ────────────────────────────────────────────────

function FormWrapper({
    children,
    defaultValues,
    onSubmit,
}: {
    children: React.ReactNode;
    defaultValues?: Partial<IdpFormValues>;
    onSubmit?: (data: IdpFormValues) => void;
}) {
    const methods = useForm<IdpFormValues>({
        resolver: zodResolver(idpFormSchema),
        defaultValues: {
            type: 'oidc',
            name: '',
            emailDomain: '',
            defaultRole: 'member',
            jitEnabled: true,
            ...defaultValues,
        },
    });

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit((data) => onSubmit?.(data))}>
                {children}
                <button type="submit">Submit</button>
            </form>
        </FormProvider>
    );
}

function renderIdpForm(options: {
    defaultValues?: Partial<IdpFormValues>;
    isEditing?: boolean;
    onSubmit?: (data: IdpFormValues) => void;
} = {}) {
    return render(
        <FormWrapper defaultValues={options.defaultValues} onSubmit={options.onSubmit}>
            <IdpForm isEditing={options.isEditing} />
        </FormWrapper>,
    );
}

// ─── Rendering based on type ──────────────────────────────────────────────────

describe('IdpForm — type=oidc shows OIDC fields only', () => {
    it('renders OIDC fields when type is oidc', () => {
        renderIdpForm({ defaultValues: { type: 'oidc' } });
        expect(screen.getByLabelText(/issuer url/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/discovery url/i)).toBeInTheDocument();
    });

    it('does NOT render SAML fields when type is oidc', () => {
        renderIdpForm({ defaultValues: { type: 'oidc' } });
        expect(screen.queryByLabelText(/entity id/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/sso url/i)).not.toBeInTheDocument();
    });
});

describe('IdpForm — type=saml shows SAML fields only', () => {
    it('renders SAML fields when type is saml', () => {
        renderIdpForm({ defaultValues: { type: 'saml' } });
        expect(screen.getByLabelText(/entity id/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/sso url/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/x\.509 certificate/i)).toBeInTheDocument();
    });

    it('does NOT render OIDC fields when type is saml', () => {
        renderIdpForm({ defaultValues: { type: 'saml' } });
        expect(screen.queryByLabelText(/issuer url/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/discovery url/i)).not.toBeInTheDocument();
    });
});

// ─── Field switching via radio ────────────────────────────────────────────────

describe('IdpForm — type radio switches fields', () => {
    it('switches to SAML fields when saml radio clicked', async () => {
        renderIdpForm({ defaultValues: { type: 'oidc' } });
        const samlRadio = screen.getByDisplayValue('saml');
        fireEvent.click(samlRadio);
        await waitFor(() => {
            expect(screen.queryByLabelText(/issuer url/i)).not.toBeInTheDocument();
            expect(screen.getByLabelText(/entity id/i)).toBeInTheDocument();
        });
    });
});

// ─── Common fields always rendered ───────────────────────────────────────────

describe('IdpForm — common fields always rendered', () => {
    it('renders provider name field', () => {
        renderIdpForm();
        expect(screen.getByLabelText(/provider name/i)).toBeInTheDocument();
    });

    it('renders email domain field', () => {
        renderIdpForm();
        expect(screen.getByLabelText(/email domain/i)).toBeInTheDocument();
    });

    it('renders default role select', () => {
        renderIdpForm();
        expect(screen.getByRole('combobox', { name: /default role/i })).toBeInTheDocument();
    });

    it('renders JIT provisioning toggle switch', () => {
        renderIdpForm();
        expect(screen.getByRole('switch', { name: /just-in-time provisioning/i })).toBeInTheDocument();
    });

    it('renders type radio group', () => {
        renderIdpForm();
        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });
});

// ─── isEditing mode ───────────────────────────────────────────────────────────

describe('IdpForm — isEditing mode', () => {
    it('shows "keep current" label for client secret when editing', () => {
        renderIdpForm({ defaultValues: { type: 'oidc' }, isEditing: true });
        expect(screen.getByLabelText(/leave empty to keep current/i)).toBeInTheDocument();
    });

    it('shows standard "client secret" label when creating (not editing)', () => {
        renderIdpForm({ defaultValues: { type: 'oidc' }, isEditing: false });
        // Should NOT have "leave empty" text
        expect(screen.queryByLabelText(/leave empty to keep current/i)).not.toBeInTheDocument();
    });
});

// ─── JIT toggle behavior ──────────────────────────────────────────────────────

describe('IdpForm — JIT toggle', () => {
    it('JIT switch starts as checked when jitEnabled=true', () => {
        renderIdpForm({ defaultValues: { type: 'oidc', jitEnabled: true } });
        const toggle = screen.getByRole('switch');
        expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('JIT switch starts as unchecked when jitEnabled=false', () => {
        renderIdpForm({ defaultValues: { type: 'oidc', jitEnabled: false } });
        const toggle = screen.getByRole('switch');
        expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('JIT toggle fires onChange when clicked', async () => {
        renderIdpForm({ defaultValues: { type: 'oidc', jitEnabled: true } });
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'false');
        });
    });
});
