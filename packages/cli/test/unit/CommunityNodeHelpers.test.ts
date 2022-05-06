import { matchPackagesWithUpdates, executeCommand, parsePackageName, matchMissingPackages } from '../../src/CommunityNodes/helpers';
import { NODE_PACKAGE_PREFIX, NPM_PACKAGE_NOT_FOUND_ERROR, RESPONSE_ERROR_MESSAGES } from '../../src/constants';

jest.mock('fs/promises');
import { access as fsAccess, mkdir as fsMkdir } from 'fs/promises';

jest.mock('child_process');
import { exec } from 'child_process';
import { InstalledPackages } from '../../src/databases/entities/InstalledPackages';
import { installedNodePayload, installedPackagePayload } from '../integration/shared/utils';
import { InstalledNodes } from '../../src/databases/entities/InstalledNodes';
import { NpmUpdatesAvailable } from '../../src/Interfaces';

describe('CommunityNodesHelper', () => {

	describe('parsePackageName', () => {
		it('Should fail with empty package name', () => {
			expect(() => parsePackageName('')).toThrowError()
		});

		it('Should fail with invalid package prefix name', () => {
			expect(() => parsePackageName('INVALID_PREFIX@123')).toThrowError()
		});

		it('Should parse valid package name', () => {
			const validPackageName = NODE_PACKAGE_PREFIX + 'cool-package-name';
			const parsedPackageName = parsePackageName(validPackageName);

			expect(parsedPackageName.originalString).toBe(validPackageName);
			expect(parsedPackageName.packageName).toBe(validPackageName);
			expect(parsedPackageName.scope).toBeUndefined();
			expect(parsedPackageName.version).toBeUndefined();
		});

		it('Should parse valid package name and version', () => {
			const validPackageName = NODE_PACKAGE_PREFIX + 'cool-package-name';
			const validPackageVersion = '0.1.1';
			const fullPackageName = `${validPackageName}@${validPackageVersion}`;
			const parsedPackageName = parsePackageName(fullPackageName);

			expect(parsedPackageName.originalString).toBe(fullPackageName);
			expect(parsedPackageName.packageName).toBe(validPackageName);
			expect(parsedPackageName.scope).toBeUndefined();
			expect(parsedPackageName.version).toBe(validPackageVersion);
		});

		it('Should parse valid package name, scope and version', () => {
			const validPackageScope = '@n8n';
			const validPackageName = NODE_PACKAGE_PREFIX + 'cool-package-name';
			const validPackageVersion = '0.1.1';
			const fullPackageName = `${validPackageScope}/${validPackageName}@${validPackageVersion}`;
			const parsedPackageName = parsePackageName(fullPackageName);

			expect(parsedPackageName.originalString).toBe(fullPackageName);
			expect(parsedPackageName.packageName).toBe(`${validPackageScope}/${validPackageName}`);
			expect(parsedPackageName.scope).toBe(validPackageScope);
			expect(parsedPackageName.version).toBe(validPackageVersion);
		});
	});

	describe('executeCommand', () => {

		beforeEach(() => {
			// @ts-ignore
			fsAccess.mockReset();
			// @ts-ignore
			fsMkdir.mockReset();
			// @ts-ignore
			exec.mockReset();
		});

		it('Should call command with valid options', async () => {
			// @ts-ignore
			exec.mockImplementation((...args) => {
				expect(args[1].cwd).toBeDefined();
				expect(args[1].env).toBeDefined();
				// PATH or NODE_PATH may be undefined depending on environment so we don't check for these keys.
				const callbackFunction = args[args.length - 1];
				callbackFunction(null, { stdout: 'Done' });
			});

			await executeCommand('ls');
			expect(fsAccess).toHaveBeenCalled();
			expect(exec).toHaveBeenCalled();
			expect(fsMkdir).toBeCalledTimes(0);
		});

		it ('Should make sure folder exists', async () => {
			// @ts-ignore
			exec.mockImplementation((...args) => {
				const callbackFunction = args[args.length - 1];
				callbackFunction(null, { stdout: 'Done' });
			});

			await executeCommand('ls');
			expect(fsAccess).toHaveBeenCalled();
			expect(exec).toHaveBeenCalled();
			expect(fsMkdir).toBeCalledTimes(0);
		});

		it ('Should try to create folder if it does not exist', async () => {
			// @ts-ignore
			exec.mockImplementation((...args) => {
				const callbackFunction = args[args.length - 1];
				callbackFunction(null, { stdout: 'Done' });
			});

			// @ts-ignore
			fsAccess.mockImplementation(() => {
				throw new Error('Folder does not exist.');
			});

			await executeCommand('ls');
			expect(fsAccess).toHaveBeenCalled();
			expect(exec).toHaveBeenCalled();
			expect(fsMkdir).toHaveBeenCalled();
		});

		it('Should throw especial error when package is not found', async() => {
			// @ts-ignore
			exec.mockImplementation((...args) => {
				const callbackFunction = args[args.length - 1];
				callbackFunction(new Error('Something went wrong - ' + NPM_PACKAGE_NOT_FOUND_ERROR + '. Aborting.'));
			});

			await expect(async () => await executeCommand('ls')).rejects.toThrow(RESPONSE_ERROR_MESSAGES.PACKAGE_NOT_FOUND);

			expect(fsAccess).toHaveBeenCalled();
			expect(exec).toHaveBeenCalled();
			expect(fsMkdir).toHaveBeenCalledTimes(0);
		});
	});


	describe('crossInformationPackage', () => {

		it('Should return same list if availableUpdates is undefined', () => {
			const fakePackages = generateListOfFakeInstalledPackages();
			const crossedData = matchPackagesWithUpdates(fakePackages);
			expect(crossedData).toEqual(fakePackages);
		});

		it ('Should correctly match update versions for packages', () => {
			const fakePackages = generateListOfFakeInstalledPackages();

			const updates: NpmUpdatesAvailable = {
				[fakePackages[0].packageName]: {
					current: fakePackages[0].installedVersion,
					wanted: fakePackages[0].installedVersion,
					latest: '0.2.0',
					location: fakePackages[0].packageName,
				},
				[fakePackages[1].packageName]: {
					current: fakePackages[0].installedVersion,
					wanted: fakePackages[0].installedVersion,
					latest: '0.3.0',
					location: fakePackages[0].packageName,
				}
			};

			const crossedData = matchPackagesWithUpdates(fakePackages, updates);

			// @ts-ignore
			expect(crossedData[0].updateAvailable).toBe('0.2.0');
			// @ts-ignore
			expect(crossedData[1].updateAvailable).toBe('0.3.0');

		});

		it ('Should correctly match update versions for single package', () => {
			const fakePackages = generateListOfFakeInstalledPackages();

			const updates: NpmUpdatesAvailable = {
				[fakePackages[1].packageName]: {
					current: fakePackages[0].installedVersion,
					wanted: fakePackages[0].installedVersion,
					latest: '0.3.0',
					location: fakePackages[0].packageName,
				}
			};

			const crossedData = matchPackagesWithUpdates(fakePackages, updates);

			// @ts-ignore
			expect(crossedData[0].updateAvailable).toBeUndefined();
			// @ts-ignore
			expect(crossedData[1].updateAvailable).toBe('0.3.0');

		});

	});

	describe('matchMissingPackages', () => {
		it('Should not match failed packages that do not exist', () => {
			const fakePackages = generateListOfFakeInstalledPackages();
			const notFoundPackageList = `${NODE_PACKAGE_PREFIX}very-long-name-that-should-never-be-generated@1.0.0 ${NODE_PACKAGE_PREFIX}another-very-long-name-that-never-is-seen`;
			const matchedPackages = matchMissingPackages(fakePackages, notFoundPackageList);

			expect(matchedPackages).toEqual(fakePackages);
			expect(matchedPackages[0].failedLoading).toBeUndefined();
			expect(matchedPackages[1].failedLoading).toBeUndefined();
		});

		it('Should match failed packages that should be present', () => {
			const fakePackages = generateListOfFakeInstalledPackages();
			const notFoundPackageList = `${NODE_PACKAGE_PREFIX}very-long-name-that-should-never-be-generated@1.0.0 ${fakePackages[0].packageName}@${fakePackages[0].installedVersion}`;
			const matchedPackages = matchMissingPackages(fakePackages, notFoundPackageList);

			expect(matchedPackages[0].failedLoading).toBe(true);
			expect(matchedPackages[1].failedLoading).toBeUndefined();
		});

		it('Should match failed packages even if version is wrong', () => {
			const fakePackages = generateListOfFakeInstalledPackages();
			const notFoundPackageList = `${NODE_PACKAGE_PREFIX}very-long-name-that-should-never-be-generated@1.0.0 ${fakePackages[0].packageName}@123.456.789`;
			const matchedPackages = matchMissingPackages(fakePackages, notFoundPackageList);

			expect(matchedPackages[0].failedLoading).toBe(true);
			expect(matchedPackages[1].failedLoading).toBeUndefined();
		});
	});
});

/**
 * Generates a list with 2 packages, one with a single node and
 * another with 2 nodes
 * @returns
 */
function generateListOfFakeInstalledPackages(): InstalledPackages[] {
	const fakeInstalledPackage1 = new InstalledPackages();
	Object.assign(fakeInstalledPackage1, installedPackagePayload());
	const fakeInstalledNode1 = new InstalledNodes();
	Object.assign(fakeInstalledNode1, installedNodePayload(fakeInstalledPackage1.packageName));
	fakeInstalledPackage1.installedNodes = [fakeInstalledNode1];

	const fakeInstalledPackage2 = new InstalledPackages();
	Object.assign(fakeInstalledPackage2, installedPackagePayload());
	const fakeInstalledNode2 = new InstalledNodes();
	Object.assign(fakeInstalledNode2, installedNodePayload(fakeInstalledPackage2.packageName));
	const fakeInstalledNode3 = new InstalledNodes();
	Object.assign(fakeInstalledNode3, installedNodePayload(fakeInstalledPackage2.packageName));
	fakeInstalledPackage2.installedNodes = [fakeInstalledNode2, fakeInstalledNode3];

	return [fakeInstalledPackage1, fakeInstalledPackage2];
}
