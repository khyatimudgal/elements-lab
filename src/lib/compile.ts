import { transform } from 'sucrase';
import * as React from 'react';
import * as elements from '@unlayer/react-elements';
import { tryCatchSync, type Result } from './try-catch';

export type WrapperConfig = {
    backgroundColor?: elements.EmailProps['backgroundColor'];
    contentWidth?: elements.EmailProps['contentWidth'];
};

export type CompiledTemplate = {
    Content: React.FunctionComponent;
    config: WrapperConfig;
};

const AVAILABLE_MODULES = new Map<string, unknown>([
    ['@unlayer/react-elements', elements],
    ['react', React],
]);

function resolveModule(specifier: string): unknown {
    if (!AVAILABLE_MODULES.has(specifier)) {
        throw new Error(
            `Cannot import "${specifier}". The playground only provides @unlayer/react-elements and react.`
        );
    }
    return AVAILABLE_MODULES.get(specifier);
}

function isWrapperConfig(value: unknown): value is WrapperConfig {
    return typeof value === 'object' && value !== null;
}

export function compileTemplate(source: string): Result<CompiledTemplate> {
    return tryCatchSync(function run() {
        const { code } = transform(source, {
            transforms: ['jsx', 'typescript', 'imports'],
            jsxRuntime: 'classic',
            production: true,
        });

        const moduleShim = { exports: {} as Record<string, unknown> };
        const factory = new Function('require', 'module', 'exports', 'React', code);
        factory(resolveModule, moduleShim, moduleShim.exports, React);

        const Content = moduleShim.exports.default;
        if (typeof Content !== 'function') {
            throw new Error(
                'Your template needs a default export that is a component, for example `export default function Content() { ... }`'
            );
        }

        const declared = moduleShim.exports.config;
        return {
            Content: Content as React.FunctionComponent,
            config: isWrapperConfig(declared) ? declared : {},
        };
    });
}
