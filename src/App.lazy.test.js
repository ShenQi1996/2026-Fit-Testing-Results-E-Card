import React, { Suspense, lazy } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ChunkErrorBoundary from './components/common/ChunkErrorBoundary';
import PageLoading from './components/common/PageLoading';

// If App imported any page statically, requiring App would load these mocks
// and throw. The pages must only load through React.lazy.
jest.mock('./components/forms/FitTestForm', () => { throw new Error('FitTestForm was imported statically'); });
jest.mock('./components/results/FitTestResults', () => { throw new Error('FitTestResults was imported statically'); });
jest.mock('./components/admin/UsersManagement', () => { throw new Error('UsersManagement was imported statically'); });
jest.mock('./components/auth/EditAccount', () => { throw new Error('EditAccount was imported statically'); });
jest.mock('./components/lookup/VerifyCardPage', () => { throw new Error('VerifyCardPage was imported statically'); });
jest.mock('./components/lookup/ResendCardPage', () => { throw new Error('ResendCardPage was imported statically'); });
jest.mock('./utils/pdfUtils', () => { throw new Error('pdfUtils was imported statically'); });
jest.mock('lottie-react', () => { throw new Error('lottie-react was imported statically'); });

test('App loads without statically importing pages, PDF tools or Lottie', () => {
  expect(() => require('./App')).not.toThrow();
});

test('a page shows the light fallback while its chunk loads, then renders', async () => {
  let resolvePage;
  const Page = lazy(() => new Promise((resolve) => { resolvePage = resolve; }));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoading />}>
          <Page />
        </Suspense>
      </ChunkErrorBoundary>
    );
  });
  expect(renderer.root.findByProps({ role: 'status' })).toBeTruthy();

  await act(async () => {
    resolvePage({ default: () => <p>page ready</p> });
  });
  expect(renderer.root.findByType('p').props.children).toBe('page ready');
});

test('a chunk that fails to download shows a reload message instead of a blank app', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const Page = lazy(() => Promise.reject(new Error('Loading chunk page-results failed')));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoading />}>
          <Page />
        </Suspense>
      </ChunkErrorBoundary>
    );
  });
  const alert = renderer.root.findByProps({ role: 'alert' });
  expect(alert.findByType('button').props.children).toBe('Reload');
  consoleError.mockRestore();
});
