import { loginInputSchema, type LoginInput } from '@lotea/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useLogin } from '../../src/features/auth/hooks/useLogin';
import { Button } from '../../src/shared/components/Button';
import { Input } from '../../src/shared/components/Input';
import { Logo } from '../../src/shared/components/Logo';
import { Text } from '../../src/shared/components/Text';
import { zodResolver } from '../../src/shared/lib/zod-resolver';
import { palette } from '../../src/shared/theme/colors';

export default function LoginScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver<LoginInput>(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });
  const loginMutation = useLogin();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // Browser autofill commonly adds a trailing space or capitalizes the
      // first letter — normalize before sending, since the server looks up
      // the email with an exact match.
      await loginMutation.mutateAsync({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      router.replace('/dashboard');
    } catch {
      setSubmitError(t('auth:loginError'));
    }
  });

  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 16, backgroundColor: palette.bg, paddingHorizontal: 24 }}>
      <View style={{ marginBottom: 10 }}>
        <Logo size="lg" />
      </View>
      <View style={{ marginBottom: 8 }}>
        <Text variant="display" color="ink" style={{ lineHeight: 34 }}>
          {t('auth:loginHeadline')}
        </Text>
        <Text variant="body" color="muted" style={{ marginTop: 8 }}>
          {t('auth:loginSubtitle')}
        </Text>
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            label={t('auth:emailLabel')}
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
            secureTextEntry
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={errors.password?.message}
          />
        )}
      />

      {/* No forgot-password flow exists yet on the backend — visual-only for now, same as the dashboard's notification bell. */}
      <Pressable accessibilityRole="button" accessibilityLabel={t('auth:forgotPassword')} style={{ alignSelf: 'flex-end', marginTop: -8 }}>
        <Text variant="body" weight="medium" color="primary" style={{ fontSize: 13 }}>
          {t('auth:forgotPassword')}
        </Text>
      </Pressable>

      {submitError ? (
        <Text variant="caption" color="danger">
          ⚠ {submitError}
        </Text>
      ) : null}

      <Button
        label={loginMutation.isPending ? t('common:loading') : t('auth:loginButton')}
        onPress={onSubmit}
        disabled={loginMutation.isPending}
        fullWidth
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
        <Text variant="body" color="muted">
          {t('auth:noAccount')}
        </Text>
        <Pressable onPress={() => router.push('/cadastro')}>
          <Text variant="body" weight="semibold" color="primary">
            {t('auth:createAccountLink')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
