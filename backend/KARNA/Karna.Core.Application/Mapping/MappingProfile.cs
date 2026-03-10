using AutoMapper;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Application.Mapping.Resolvers;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	public class MappingProfile : Profile
	{
		public MappingProfile()
		{
			CreateMap<Make, MakeDto>()
				.ForMember(dest => dest.Name, opt => opt.MapFrom<LocalizedMakeNameResolver>())
				.ForMember(dest => dest.Country, opt => opt.MapFrom<LocalizedMakeCountryResolver>())
				.ForMember(dest => dest.LogoUrl, opt => opt.MapFrom<MakesLogoUrlResolver>());

			CreateMap<CreateMakeDto, Make>()
				.ForMember(dest => dest.Id, opt => opt.Ignore())
				.ForMember(dest => dest.LogoUrl, opt => opt.Ignore())
				.ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
				.ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
				.ForMember(dest => dest.IsDeleted, opt => opt.Ignore());

			CreateMap<UpdateMakeDto, Make>()
				.ForMember(dest => dest.Id, opt => opt.Ignore())
				.ForMember(dest => dest.LogoUrl, opt => opt.Ignore())
				.ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
				.ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
				.ForMember(dest => dest.IsDeleted, opt => opt.Ignore());

			CreateMap<Model, ModelDto>()
				.ForMember(dest => dest.Name, opt => opt.MapFrom<LocalizedModelNameResolver>())
				.ForMember(dest => dest.MakeName,opt => opt.MapFrom<LocalizedMakeNameFromModelResolver>());

            CreateMap<CreateModelDto, Model>()
				.ForMember(des => des.Id, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.IsDeleted, opt => opt.Ignore())
                .ForMember(dest => dest.Make, opt => opt.Ignore());


            CreateMap<UpdateModelDto, Model>()
                .ForMember(des => des.Id, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
                .ForMember(dest => dest.IsDeleted, opt => opt.Ignore())
			    .ForMember(dest => dest.Make, opt => opt.Ignore());


        }
    }
}