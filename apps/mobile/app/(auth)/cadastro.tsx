import { registerInputSchema, type RegisterInput } from '@lotea/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useRegister } from '../../src/features/auth/hooks/useRegister';
import { Button } from '../../src/shared/components/Button';
import { Input } from '../../src/shared/components/Input';
import { Logo } from '../../src/shared/components/Logo';
import { Text } from '../../src/shared/components/Text';
import { zodResolver } from '../../src/shared/lib/zod-resolver';
import { palette } from '../../src/shared/theme/colors';

function TermsCheckbox({ checked, onToggle, t }: { checked: boolean; onToggle: () => void; t: (key: string) => string }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          marginTop: 1,
          backgroundColor: checked ? palette.primary : palette.surface,
          borderWidth: checked ? 0 : 1.5,
          borderColor: palette.divider,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Text style={{ color: '#FFFFFF', fontSize: 12, lineHeight: 12 }} weight="bold">
            ✓
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color="muted" style={{ flex: 1, lineHeight: 18 }}>
        {t('auth:termsPrefix')}
        <Text variant="caption" weight="medium" color="primary">
          {t('auth:termsOfUse')}
        </Text>
        {t('auth:termsMiddle')}
        <Text variant="caption" weight="medium" color="primary">
          {t('auth:privacyPolicy')}
        </Text>
      </Text>
    </Pressable>
  );
}

export default function CadastroScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver<RegisterInput>(registerInputSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const registerMutation = useRegister();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    if (!acceptedTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    setSubmitError(null);
    try {
      await registerMutation.mutateAsync({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      router.replace('/dashboard');
    } catch {
      setSubmitError(t('auth:registerError'));
    }
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 40 }}
    >
      <View style={{ marginBottom: 12 }}>
        <Logo size="sm" />
      </View>
      <View style={{ marginBottom: 8 }}>
        <Text variant="heading1" color="ink">
          {t('auth:registerTitle')}
        </Text>
        <Text variant="body" color="muted" style={{ marginTop: 4 }}>
          {t('auth:registerSubtitle')}
        </Text>
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label={t('auth:nameLabel')}
            placeholder={t('auth:namePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label={t('auth:emailLabel')}
            placeholder={t('auth:emailPlaceholder')}
            autoCapitalize="none"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Input
            label={t('auth:passwordLabel')}
            placeholder={t('auth:passwordPlaceholder')}
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={errors.password?.message}
          />
        )}
      />

      <TermsCheckbox checked={acceptedTerms} onToggle={() => setAcceptedTerms((current) => !current)} t={t} />
      {termsError ? (
        <Text variant="caption" color="danger">
          ⚠ {t('auth:termsRequired')}
        </Text>
      ) : null}

      {submitError ? (
        <Text variant="caption" color="danger">
          ⚠ {submitError}
        </Text>
      ) : null}

      <Button
        label={registerMutation.isPending ? t('common:loading') : t('auth:registerButton')}
        onPress={onSubmit}
        disabled={registerMutation.isPending}
        fullWidth
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
        <Text variant="body" color="muted">
          {t('auth:hasAccount')}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text variant="body" weight="semibold" color="primary">
            {t('auth:loginLink')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
