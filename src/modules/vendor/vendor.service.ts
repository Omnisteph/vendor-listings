import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { RegisterVendorDto, SendInviteLinkDto } from './dto/vendor.request.';
import { PrismaService } from 'src/prisma.service';
import * as argon2 from 'argon2';
import { generateToken } from 'src/utils/generateToken';
import { daysToUnix, unixToDaysLeft } from 'src/utils/date';
import { MailService } from '../mail/mail.service';
import { MAIL_MESSAGE, MAIL_SUBJECT } from '../mail/mail.contants';

@Injectable()
export class VendorService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async sendVendorInviteLink(input: SendInviteLinkDto) {
    const { vendorEmail } = input;

    await this.__checkIfVendorExists(vendorEmail);

    const inviteToken = generateToken();

    await this.prisma.invite.create({
      data: {
        email: vendorEmail,
        expires: `${daysToUnix(2)}`, // link expires in 2 days
        inviteToken,
      },
    });

    await this.mailService.sendMail({
      to: vendorEmail,
      subject: MAIL_SUBJECT.VENDOR_INVITATION,
      html: MAIL_MESSAGE.VENDOR_INVITATION(
        `${process.env.CLIENT_DEPLOYED_URL}/registration?token=${inviteToken}`,
      ),
    });

    return true;
  }

  async registerVendor(input: RegisterVendorDto) {
    const {
      inviteToken,
      businessEmail,
      address,
      businessAddress,
      businessName,
      businessPhoneNumber,
      category,
      email,
      firstName,
      lastName,
      otherPhoneNumber,
      phoneNumber,
    } = input;

    await this.__checkIfInviteTokenIsValid(inviteToken, businessEmail);
    await this.__checkEmailTaken(email, businessEmail);

    const passwordHash = await argon2.hash(lastName);

    await this.prisma.user.create({
      data: {
        address,
        firstName,
        lastName,
        email,
        phoneNumber,
        password: {
          create: {
            passwordHash,
          },
        },
        vendor: {
          create: {
            address: businessAddress,
            businessName,
            category,
            email: businessEmail,
            phoneNumber: businessPhoneNumber,
            otherPhoneNumber,
          },
        },
      },
    });

    await this.__deleteVendorInvite(businessEmail, inviteToken);

    return true;
  }

  async __checkIfVendorExists(email: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { email } });
    if (vendor) throw new BadRequestException('Vendor already exists.');
  }

  async __checkIfInviteTokenIsValid(inviteToken: string, vendorEmail: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { inviteToken },
    });

    if (!invite) throw new BadRequestException('Invalid invite');

    if (invite.email !== vendorEmail) {
      throw new BadRequestException('Invalid invite');
    }

    if (!invite.valid) {
      throw new BadRequestException('Invalid invite');
    }

    if (unixToDaysLeft(Number(invite.expires)) < 1) {
      throw new BadRequestException('Invalid invite');
    }
  }

  async __deleteVendorInvite(email: string, inviteToken: string) {
    await this.prisma.invite.deleteMany({
      where: { AND: [{ email }, { inviteToken }] },
    });
  }

  async __checkEmailTaken(userEmail: string, vendorEmail: string) {
    const userEmailTaken = await this.prisma.user.findFirst({
      where: { email: userEmail },
    });
    if (userEmailTaken) throw new ConflictException('email has been used');

    const vendorEmailTaken = await this.prisma.vendor.findUnique({
      where: { email: vendorEmail },
    });
    if (vendorEmailTaken) throw new ConflictException('email has been used');
  }

  // async __checkIfInvitationExists(email: string) {
  //   const invite = await this.prisma.invite.findFirstOrThrow({
  //     where: { email },
  //   });

  //   if (invite.valid) throw new BadRequestException('Invite link is invalid.');

  //   if (unixToDaysLeft(Number(invite.expires)) < 1) {
  //     throw new BadRequestException('Invite link is invalid.');
  //   }
  // }
}
