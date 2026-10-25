"""Static deployment guardrails; run with cfn-lint installed, without AWS credentials."""
import pathlib
import re
import unittest
from cfnlint.decode import decode


class InfrastructureSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template, errors = decode(str(pathlib.Path(__file__).parents[1] / 'template.yaml'))
        if errors:
            raise ValueError(errors)
        cls.resources = cls.template['Resources']

    def properties(self, name):
        return self.resources[name]['Properties']

    def test_database_has_no_public_access_and_requires_encryption_and_tls(self):
        database = self.properties('Database')
        self.assertIs(database['PubliclyAccessible'], False)
        self.assertIs(database['StorageEncrypted'], True)
        self.assertIs(database['ManageMasterUserPassword'], True)
        self.assertEqual(self.properties('DatabaseParameters')['Parameters']['rds.force_ssl'], '1')
        ingress = self.properties('DatabaseSecurityGroup')['SecurityGroupIngress']
        self.assertEqual(len(ingress), 1)
        self.assertEqual(ingress[0]['SourceSecurityGroupId'], {'Ref': 'LambdaSecurityGroup'})
        self.assertEqual((ingress[0]['FromPort'], ingress[0]['ToPort']), (5432, 5432))

    def test_data_and_its_private_network_survive_stack_deletion(self):
        for name in ['Database', 'RuntimeDatabaseSecret', 'PrivateVpc', 'PrivateSubnetA', 'PrivateSubnetB', 'DatabaseSecurityGroup', 'DatabaseSubnets', 'UserPool']:
            self.assertEqual(self.resources[name]['DeletionPolicy'], 'Retain', name)
            self.assertEqual(self.resources[name]['UpdateReplacePolicy'], 'Retain', name)
        self.assertTrue(self.properties('Database')['DeletionProtection'])

    def test_runtime_role_cannot_read_master_secret(self):
        statements = self.properties('ApiRole')['Policies'][0]['PolicyDocument']['Statement']
        self.assertEqual(statements, [{'Effect': 'Allow', 'Action': 'secretsmanager:GetSecretValue', 'Resource': {'Ref': 'RuntimeDatabaseSecret'}}])
        self.assertEqual(self.properties('ApiFunction')['Environment']['Variables']['DB_SECRET_ARN'], {'Ref': 'RuntimeDatabaseSecret'})

    def test_migration_has_no_network_invocation_surface(self):
        migration = self.properties('MigrationFunction')
        self.assertNotIn('Events', migration)
        self.assertNotIn('FunctionUrlConfig', migration)
        self.assertEqual(migration['ReservedConcurrentExecutions'], 1)
        self.assertNotEqual(migration['Role'], self.properties('ApiFunction')['Role'])

    def test_host_route_requires_jwt_and_guest_route_explicitly_does_not(self):
        api = self.properties('HttpApi')
        self.assertEqual(api['Auth']['DefaultAuthorizer'], 'HostIdentity')
        events = self.properties('ApiFunction')['Events']
        self.assertEqual(events['HostRequest']['Properties']['Path'], '/host')
        self.assertNotIn('Auth', events['HostRequest']['Properties'])
        self.assertEqual(events['GuestRequest']['Properties']['Auth'], {'Authorizer': 'NONE'})
        self.assertLessEqual(api['RouteSettings']['POST /guest']['ThrottlingRateLimit'], 10)
        allowed_origins = api['CorsConfiguration']['AllowOrigins']['Fn::If']
        self.assertEqual(allowed_origins[0], 'IncludeLocalhost')
        self.assertEqual(allowed_origins[2], [{'Ref': 'AppOrigin'}])
        self.assertEqual(self.template['Parameters']['AllowLocalhost']['Default'], 'false')
        self.assertEqual(self.properties('ApiFunction')['Environment']['Variables']['ALLOWED_ORIGINS']['Fn::If'][2], {'Ref': 'AppOrigin'})

    def test_passwordless_login_uses_essentials_and_public_code_client(self):
        pool = self.properties('UserPool')
        self.assertEqual(pool['UserPoolTier'], 'ESSENTIALS')
        self.assertEqual(pool['Policies']['SignInPolicy']['AllowedFirstAuthFactors'], ['EMAIL_OTP'])
        self.assertIn('email', pool['AutoVerifiedAttributes'])
        client = self.properties('BrowserClient')
        self.assertIs(client['GenerateSecret'], False)
        self.assertEqual(client['AllowedOAuthFlows'], ['code'])
        self.assertEqual(client['IdTokenValidity'], 15)
        self.assertEqual(client['TokenValidityUnits']['IdToken'], 'minutes')
        self.assertIn('ALLOW_USER_AUTH', client['ExplicitAuthFlows'])
        self.assertEqual(self.properties('LoginDomain')['ManagedLoginVersion'], 2)

    def test_database_version_accepts_real_postgresql_16_minor_numbers(self):
        pattern = self.template['Parameters']['DatabaseEngineVersion']['AllowedPattern']
        self.assertIsNotNone(re.fullmatch(pattern, '16.14'))
        self.assertIsNotNone(re.fullmatch(pattern, '16.15'))
        self.assertIsNone(re.fullmatch(pattern, '17.1'))
        self.assertNotIn('Default', self.template['Parameters']['DatabaseEngineVersion'])

    def test_email_code_sign_in_requires_a_verified_ses_sender(self):
        email = self.properties('UserPool')['EmailConfiguration']
        self.assertEqual(email['EmailSendingAccount'], 'DEVELOPER')
        self.assertEqual(email['SourceArn'], {'Ref': 'SesIdentityArn'})
        self.assertEqual(email['From'], {'Ref': 'SesFromAddress'})
        self.assertNotIn('Default', self.template['Parameters']['SesIdentityArn'])
        self.assertNotIn('Default', self.template['Parameters']['SesFromAddress'])

    def test_isolated_network_uses_private_secrets_endpoint(self):
        types = {resource['Type'] for resource in self.resources.values()}
        self.assertNotIn('AWS::EC2::InternetGateway', types)
        self.assertNotIn('AWS::EC2::NatGateway', types)
        self.assertNotIn('AWS::EC2::Route', types)
        for name in ['PrivateSubnetA', 'PrivateSubnetB']:
            self.assertIs(self.properties(name)['MapPublicIpOnLaunch'], False)
        endpoint = self.properties('SecretsEndpoint')
        self.assertEqual(endpoint['VpcEndpointType'], 'Interface')
        self.assertTrue(endpoint['PrivateDnsEnabled'])
        self.assertEqual(len(endpoint['PolicyDocument']['Statement'][0]['Resource']), 2)

    def test_public_outputs_contain_no_credentials_or_secret_references(self):
        rendered = str(self.template['Outputs'])
        for forbidden in ['SecretArn', 'password', 'RuntimeDatabaseSecret', 'MasterUserSecret']:
            self.assertNotIn(forbidden, rendered)


if __name__ == '__main__':
    unittest.main()
