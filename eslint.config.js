import eslintJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const crossAppDeepImportPattern = {
    regex: String.raw`(?:^|/)(?:apps/)?(?:api|bot|web)/(?:src|prisma|config)(?:/|$)`,
    message: '別appの内部コード、Prisma schema、設定を直接importせず、公開されたcontractを介してください。'
};

const outerFrameworkImportPattern = {
    regex: String.raw`^(?:@prisma/client|discord\.js|ioredis|redis|next(?:/.*)?|react(?:/.*)?)$`,
    message: 'domain/applicationへframeworkやinfrastructure clientを持ち込まず、portを介してください。'
};

const createRestrictedImportsRule = (...patterns) => [
    'error',
    {
        patterns: [crossAppDeepImportPattern, ...patterns]
    }
];

const compositionRootImportMessage = '下位コードからentrypointやbootstrapをimportせず、constructorまたはfactoryから依存を注入してください。';

const createCompositionRootZones = (root) => [
    {
        target: `${root}/src/**/*`,
        from: `${root}/src/index.ts`,
        message: compositionRootImportMessage
    },
    {
        target: `${root}/src/**/*`,
        from: `${root}/src/bootstrap`,
        message: compositionRootImportMessage
    }
];

const compositionRootZones = ['api', 'bot', 'web'].flatMap((appName) => createCompositionRootZones(`./apps/${appName}`));

export default [
    /**
     * 推奨される基本設定
     */
    eslintJs.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    /**
     * TypeScriptのカスタムルール
     */
    {
        languageOptions: {
            parserOptions: {
                project: true, // tsconfig.jsonを見つける
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            // 未使用の引数や変数をエラーにする
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_', // 引数名が_で始まる場合は未使用でもエラーにしない
                    varsIgnorePattern: '^_', // 変数名が_で始まる場合は未使用でもエラーにしない
                    caughtErrorsIgnorePattern: '^_' // catchのエラー名が_で始まる場合は未使用でもエラーにしない
                }
            ],
            // public, privateなどのアクセス修飾子を必須にする
            '@typescript-eslint/explicit-member-accessibility': 'error',
            // 関数の戻り値の型指定を必須にする
            '@typescript-eslint/explicit-function-return-type': 'error',
            // 命名規則をサーバーサイド向けに簡略化
            '@typescript-eslint/naming-convention': [
                'error',
                // 基本はcamelCase
                {
                    selector: 'default',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow'
                },
                // 定数はUPPER_CASEを許可
                {
                    selector: 'variable',
                    modifiers: ['const'],
                    format: ['camelCase', 'UPPER_CASE']
                },
                // インポートはcamelCaseかPascalCase
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase']
                },
                // 型定義(class, interface, type, enum)はPascalCase
                {
                    selector: 'typeLike',
                    format: ['PascalCase']
                }
            ]
        }
    },

    /**
     * import関連のルール
     */
    {
        plugins: {
            'simple-import-sort': simpleImportSort,
            import: importPlugin
        },
        settings: {
            ...importPlugin.flatConfigs.typescript.settings,
            'import/resolver': {
                typescript: {
                    project: ['./apps/*/tsconfig.json', './packages/*/tsconfig.json']
                }
            }
        },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'import/first': 'error',
            'import/newline-after-import': 'error',
            'import/no-duplicates': 'error',
            'import/no-cycle': ['error', { ignoreExternal: true }]
        }
    },
    /** app間の境界 */
    {
        files: ['apps/*/{src,tests,integration-tests,e2e}/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': createRestrictedImportsRule()
        }
    },
    /** 下位コードからcomposition rootへの逆依存を禁止する */
    {
        files: ['apps/*/src/**/*.{ts,tsx}'],
        ignores: ['apps/*/src/index.ts', 'apps/*/src/bootstrap/**/*'],
        rules: {
            'import/no-restricted-paths': [
                'error',
                {
                    zones: compositionRootZones
                }
            ]
        }
    },
    /**
     * Clean Architectureの依存方向
     */
    {
        files: ['apps/*/src/domain/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': createRestrictedImportsRule(outerFrameworkImportPattern, {
                regex: String.raw`(?:^|/)(?:application|interface-adapter|infrastructure|bootstrap|app)(?:/|$)`,
                message: 'domainは他のレイヤーへ依存できません。'
            })
        }
    },
    {
        files: ['apps/*/src/application/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': createRestrictedImportsRule(outerFrameworkImportPattern, {
                regex: String.raw`(?:^|/)(?:interface-adapter|infrastructure|bootstrap|app)(?:/|$)`,
                message: 'applicationはadapter、infrastructure、bootstrapへ依存できません。'
            })
        }
    },
    {
        files: ['apps/*/src/interface-adapter/**/*.{ts,tsx}', 'apps/*/src/app/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': createRestrictedImportsRule({
                regex: String.raw`(?:^|/)(?:infrastructure|bootstrap)(?:/|$)`,
                message: 'interface adapterはinfrastructureやbootstrapを直接importできません。'
            })
        }
    },
    {
        files: ['apps/*/src/infrastructure/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': createRestrictedImportsRule({
                regex: String.raw`(?:^|/)(?:interface-adapter|app|bootstrap)(?:/|$)`,
                message: 'infrastructureはinterface adapterやbootstrapへ依存できません。'
            })
        }
    },
    /**
     * 無視するファイル・ディレクトリ
     */
    {
        ignores: ['**/node_modules/', '**/dist/', '**/logs/', '**/run/', '*.config.js', '*.config.ts', '.env', '.env.*']
    },
    /**
     * Prettierとの競合を避ける設定
     */
    eslintPluginPrettierRecommended,
    eslintConfigPrettier
];
