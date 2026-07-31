import { render, screen } from '@testing-library/react-native';

import '../src/shared/i18n';
import HomeScreen from './index';

describe('HomeScreen', () => {
  it('renders the app name and tagline in pt-BR', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('Lotea')).toBeTruthy();
    expect(screen.getByText('Controle simples do seu estoque e lucro.')).toBeTruthy();
  });
});
